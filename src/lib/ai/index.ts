// AI抽象化レイヤー。AI_API_KEY未設定時はモック実装で動作する(ARCHITECTURE.md参照)。
// 特定ベンダーへの依存を避けるため、呼び出し側はこのモジュールの関数のみを利用する。

export type RateMasterCandidate = {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  costPrice: number | null;
  category: string;
};

export type DraftQuoteItem = {
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string;
  unitPriceHint: number | null; // 参考値。確定単価としては使わない(REQUIREMENTS.md)
  costPriceHint: number | null;
  categoryHint: string | null;
  // 会社単価マスタと一致した場合のみ設定する。一致しない場合はnull(単価不明として扱う)
  matchedRateItemId: string | null;
};

const isMockMode = () => !process.env.AI_API_KEY;

// 実際のAI呼び出しはAnthropicのMessages APIを直接fetchする(SDKを追加せず依存を増やさない)。
// 軽量・低コストなモデルを使う(構造化データの抽出のみが目的で、高度な推論は不要なため)。
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

async function callAnthropic(system: string, userMessage: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Unexpected Anthropic response shape");
  return text;
}

/** Claudeが```json``` で囲んで返すことがあるため取り除いてからJSONとして解釈する。 */
function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json\s*|```\s*$/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * 自由記述の工事内容テキストから見積項目の下書きを作成する。
 * rateMaster(会社単価マスタ)と品目名が一致した場合のみ単価・原価・区分を反映する。
 * 一致しないものは単価を確定させず、常に priceSource=AI_ESTIMATE(参考値・単価不明)として
 * 呼び出し側で扱うこと(REQUIREMENTS.md「単価表に無いものは勝手に決めない」)。
 */
export async function draftQuoteItemsFromText(
  freeText: string,
  rateMaster: RateMasterCandidate[] = []
): Promise<DraftQuoteItem[]> {
  if (isMockMode()) {
    return mockDraftQuoteItems(freeText, rateMaster);
  }
  try {
    return await aiDraftQuoteItems(freeText, rateMaster);
  } catch (err) {
    // AI呼び出しが失敗しても見積作成自体は止めない(ルールベースの下書きにフォールバックする)
    console.error("[ai] draftQuoteItemsFromText: falling back to mock", err);
    return mockDraftQuoteItems(freeText, rateMaster);
  }
}

/**
 * AIには「文章から品目名・数量・単位を読み取る」ことだけをさせ、単価・原価・区分は
 * 一切AIに決めさせない。読み取った品目名を、これまでどおり findRateMatch で会社の
 * 単価マスタと機械的に突き合わせてから返す(AIが単価を勝手に確定しないというルールは
 * モック実装と全く同じ形で維持する)。
 */
async function aiDraftQuoteItems(
  freeText: string,
  rateMaster: RateMasterCandidate[]
): Promise<DraftQuoteItem[]> {
  const system = `あなたは建設工事の見積書作成を補助するアシスタントです。
与えられた工事内容の自由記述テキストから、見積の明細候補を抽出してください。
必ずJSON配列のみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
各要素は次の形式にしてください: {"itemName": string, "spec": string または null, "quantity": number, "unit": string}
単価・金額・原価は絶対に含めないでください(それらは別の仕組みで会社の単価表と突き合わせます)。
数量・単位が文中に明記されていない場合は quantity を 1、unit を "式" としてください。`;

  const raw = await callAnthropic(system, freeText);
  const parsed = extractJson<{ itemName: string; spec: string | null; quantity: number; unit: string }[]>(
    raw
  );
  if (!parsed || !Array.isArray(parsed)) {
    throw new Error("AI response was not a valid JSON array");
  }

  return parsed.map((item) => {
    const matched = findRateMatch(item.itemName, rateMaster);
    return {
      itemName: item.itemName,
      spec: item.spec ?? null,
      quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1,
      unit: matched?.unit ?? item.unit ?? "式",
      unitPriceHint: matched?.unitPrice ?? null,
      costPriceHint: matched?.costPrice ?? null,
      categoryHint: matched?.category ?? null,
      matchedRateItemId: matched?.id ?? null,
    };
  });
}

// 工事の数量表記としてよく使われる単位。長いもの(人日等)を先に判定できるよう順序を意識する。
const QUANTITY_UNIT_PATTERN = /(\d+(?:\.\d+)?)\s*(人日|m2|m3|m²|m³|㎡|㎥|kg|t|台|本|枚|式|日|m)/;

/** 「L型側溝撤去新設33m」のような文から数量と単位を抜き出す。見つからなければ1式とする。 */
function parseQuantity(line: string): { quantity: number; unit: string } {
  const match = line.match(QUANTITY_UNIT_PATTERN);
  if (!match) return { quantity: 1, unit: "式" };
  const unit = match[2] === "m2" || match[2] === "㎡" ? "m2" : match[2] === "m3" || match[2] === "㎥" ? "m3" : match[2];
  return { quantity: Number(match[1]), unit };
}

// 「3人4日」のような労務表記を人日換算する(先に判定し、上のQUANTITY_UNIT_PATTERNより優先する)。
const LABOR_PATTERN = /(\d+)\s*人\s*(\d+)\s*日/;

function findRateMatch(
  itemName: string,
  rateMaster: RateMasterCandidate[]
): RateMasterCandidate | null {
  const normalized = itemName.replace(/\s/g, "");
  // 双方向の部分一致で判定する(マスタの品目名の方が長い/短いどちらのケースもあるため)。
  return (
    rateMaster.find((r) => {
      const rateName = r.name.replace(/\s/g, "");
      return normalized.includes(rateName) || rateName.includes(normalized);
    }) ?? null
  );
}

function mockDraftQuoteItems(freeText: string, rateMaster: RateMasterCandidate[]): DraftQuoteItem[] {
  return freeText
    .split(/\r?\n|、|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const laborMatch = line.match(LABOR_PATTERN);
      const { quantity, unit } = laborMatch
        ? { quantity: Number(laborMatch[1]) * Number(laborMatch[2]), unit: "人日" }
        : parseQuantity(line);

      // 数量表記部分を取り除いた残りを品目名として使う(「L型側溝撤去新設33m」→「L型側溝撤去新設」)
      const itemName = line.replace(QUANTITY_UNIT_PATTERN, "").replace(LABOR_PATTERN, "").trim() || line;

      const matched = findRateMatch(itemName, rateMaster);

      return {
        itemName,
        spec: null,
        quantity,
        unit: matched?.unit ?? unit,
        unitPriceHint: matched?.unitPrice ?? null,
        costPriceHint: matched?.costPrice ?? null,
        categoryHint: matched?.category ?? null,
        matchedRateItemId: matched?.id ?? null,
      };
    });
}

export type DailyReportDraft = {
  siteName: string | null;
  weather: string | null;
  workerCount: number | null;
  machinery: string | null;
  workContent: string | null;
  quantityWorked: string | null;
  safetyNotes: string | null;
  // 2026-08-05追記(既存Excel日報の忠実再現+音声入力拡張)
  foremanName: string | null;
  vehicles: string | null;
  startTime: string | null;
  endTime: string | null;
  dangerPrediction: string | null;
  nextDayPlan: string | null;
  unclearItems: { field: string; note: string }[];
};

const WEATHER_WORDS = ["晴れ", "曇り", "雨", "雪", "晴天", "曇天"];
const MACHINERY_WORDS = ["バックホウ", "ブルドーザー", "クレーン", "ローラー", "プレート", "0.25BH", "0.45BH"];
// 使用車両は使用機械(施工用重機)とは別枠として扱う(依頼項目「使用機械」「使用車両」を分けるため)
const VEHICLE_WORDS = ["ダンプ", "ダンプトラック", "4トンダンプ", "2トンダンプ", "軽トラ", "トラック"];

/** 「8時」「17時」等の発話を "HH:mm" 形式へ変換する */
function toHHMM(hourText: string): string {
  const hour = Number(hourText);
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * 音声入力(または自由記述)テキストから日報の構造化フィールドを抽出する下書きを作成する。
 * 認識・抽出できなかった項目は勝手に補完せず unclearItems に確認候補として積む
 * (REQUIREMENTS.md 音声入力機能の必須仕様)。
 */
export async function draftDailyReportFromText(rawText: string): Promise<DailyReportDraft> {
  if (isMockMode()) {
    return mockDraftDailyReport(rawText);
  }
  try {
    return await aiDraftDailyReport(rawText);
  } catch (err) {
    // AI呼び出しが失敗しても日報作成自体は止めない(ルールベースの下書きにフォールバックする)
    console.error("[ai] draftDailyReportFromText: falling back to mock", err);
    return mockDraftDailyReport(rawText);
  }
}

const DAILY_REPORT_FIELD_LABEL: Record<string, string> = {
  siteName: "現場名",
  weather: "天候",
  workerCount: "作業員数",
  safetyNotes: "安全事項",
  foremanName: "職長",
  startTime: "開始時間",
  endTime: "終了時間",
  dangerPrediction: "危険予知",
  nextDayPlan: "翌日の予定",
};

/**
 * AIに項目抽出をさせるが、「明記されていない項目を推測で埋めない」ことを厳しく指示する。
 * nullで返ってきた項目は、モック実装と同じくunclearItems(確認候補)として積む。
 */
async function aiDraftDailyReport(rawText: string): Promise<DailyReportDraft> {
  const system = `あなたは建設現場の作業日報作成を補助するアシスタントです。
与えられた音声認識結果(またはテキスト)から、日報の項目を抽出してください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"siteName": string|null, "weather": string|null, "workerCount": number|null, "machinery": string|null, "vehicles": string|null, "quantityWorked": string|null, "safetyNotes": string|null, "foremanName": string|null, "startTime": string|null, "endTime": string|null, "dangerPrediction": string|null, "nextDayPlan": string|null}
startTime/endTimeは"HH:mm"形式にしてください。
最も重要な注意: 文中に明確に述べられていない項目は、絶対に推測で埋めずnullにしてください。
「異常なし」「良好」等、確認できていない安全確認の結果を勝手に作らないでください。`;

  const raw = await callAnthropic(system, rawText);
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  const asNumberOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

  const draft: DailyReportDraft = {
    siteName: asStringOrNull(parsed.siteName),
    weather: asStringOrNull(parsed.weather),
    workerCount: asNumberOrNull(parsed.workerCount),
    machinery: asStringOrNull(parsed.machinery),
    workContent: rawText.trim() || null,
    quantityWorked: asStringOrNull(parsed.quantityWorked),
    safetyNotes: asStringOrNull(parsed.safetyNotes),
    foremanName: asStringOrNull(parsed.foremanName),
    vehicles: asStringOrNull(parsed.vehicles),
    startTime: asStringOrNull(parsed.startTime),
    endTime: asStringOrNull(parsed.endTime),
    dangerPrediction: asStringOrNull(parsed.dangerPrediction),
    nextDayPlan: asStringOrNull(parsed.nextDayPlan),
    unclearItems: [],
  };

  for (const [key, label] of Object.entries(DAILY_REPORT_FIELD_LABEL)) {
    if ((draft as unknown as Record<string, unknown>)[key] === null) {
      draft.unclearItems.push({ field: label, note: "音声からは特定できませんでした" });
    }
  }

  return draft;
}

function mockDraftDailyReport(rawText: string): DailyReportDraft {
  const unclearItems: { field: string; note: string }[] = [];

  const siteMatch = rawText.match(/現場は?([^\s、。]+)/);
  const siteName = siteMatch ? siteMatch[1] : null;
  if (!siteName) unclearItems.push({ field: "現場名", note: "音声からは特定できませんでした" });

  const weather = WEATHER_WORDS.find((w) => rawText.includes(w)) ?? null;
  if (!weather) unclearItems.push({ field: "天候", note: "音声からは特定できませんでした" });

  const workerMatch = rawText.match(/作業員\s*(\d+)\s*名/);
  const workerCount = workerMatch ? Number(workerMatch[1]) : null;
  if (workerCount === null) unclearItems.push({ field: "作業員数", note: "音声からは特定できませんでした" });

  const foundMachinery = MACHINERY_WORDS.filter((m) => rawText.includes(m));
  const machinery = foundMachinery.length > 0 ? foundMachinery.join("、") : null;

  const foundVehicles = VEHICLE_WORDS.filter((v) => rawText.includes(v));
  const vehicles = foundVehicles.length > 0 ? foundVehicles.join("、") : null;

  const quantityMatches = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*(立米|m3|m²|㎡|m)/g)];
  const quantityWorked =
    quantityMatches.length > 0
      ? quantityMatches.map((m) => `${m[1]}${m[2]}`).join("、")
      : null;

  const hasNoIncident = /(事故なし|異常なし|異常はなし|問題なし)/.test(rawText);
  const safetyNotes = hasNoIncident ? "特に異常なし" : null;
  if (!hasNoIncident) unclearItems.push({ field: "安全事項", note: "音声からは特定できませんでした" });

  const foremanMatch =
    rawText.match(/職長は?([^\s、。]+)/) ?? rawText.match(/([^\s、。]+)が職長/);
  const foremanName = foremanMatch ? foremanMatch[1] : null;
  if (!foremanName) unclearItems.push({ field: "職長", note: "音声からは特定できませんでした" });

  const startMatch = rawText.match(/(\d{1,2})時\s*(?:開始|から)/);
  const startTime = startMatch ? toHHMM(startMatch[1]) : null;
  if (!startTime) unclearItems.push({ field: "開始時間", note: "音声からは特定できませんでした" });

  const endMatch = rawText.match(/(\d{1,2})時\s*(?:終了|まで)/);
  const endTime = endMatch ? toHHMM(endMatch[1]) : null;
  if (!endTime) unclearItems.push({ field: "終了時間", note: "音声からは特定できませんでした" });

  const dangerMatch = rawText.match(/危険(?:箇所|予知)は?([^。]+)/);
  const dangerPrediction = dangerMatch ? dangerMatch[1].trim() : null;
  if (!dangerPrediction) unclearItems.push({ field: "危険予知", note: "音声からは特定できませんでした" });

  const nextDayMatch = rawText.match(/(?:翌日|明日)は?([^。]+)/);
  const nextDayPlan = nextDayMatch ? nextDayMatch[1].trim() : null;
  if (!nextDayPlan) unclearItems.push({ field: "翌日の予定", note: "音声からは特定できませんでした" });

  return {
    siteName,
    weather,
    workerCount,
    machinery,
    workContent: rawText.trim() || null,
    quantityWorked,
    safetyNotes,
    foremanName,
    vehicles,
    startTime,
    endTime,
    dangerPrediction,
    nextDayPlan,
    unclearItems,
  };
}

// ダッシュボードの「何でも音声で話す」窓口が、話した内容を日報かKY(危険予知)の
// どちらに振り分けるかを判定する。どちらとも言い切れない内容(挨拶のみ・意味不明瞭等)は
// 日報側に倒す(現場で最も使う頻度が高く、間違えても内容はそのまま確認・修正できるため)。
export type VoiceIntent = "DAILY_REPORT" | "KY";

const KY_INTENT_WORDS = ["危険予知", "ヒヤリハット", "ヒヤリ・ハット", "KY活動", "危険ポイント", "危険予知活動"];

export async function classifyVoiceIntent(rawText: string): Promise<VoiceIntent> {
  if (isMockMode()) {
    return mockClassifyVoiceIntent(rawText);
  }
  try {
    return await aiClassifyVoiceIntent(rawText);
  } catch (err) {
    console.error("[ai] classifyVoiceIntent: falling back to mock", err);
    return mockClassifyVoiceIntent(rawText);
  }
}

function mockClassifyVoiceIntent(rawText: string): VoiceIntent {
  return KY_INTENT_WORDS.some((w) => rawText.includes(w)) ? "KY" : "DAILY_REPORT";
}

async function aiClassifyVoiceIntent(rawText: string): Promise<VoiceIntent> {
  const system = `あなたは建設現場の音声入力を振り分けるアシスタントです。
話された内容が次のどちらに近いか判定し、"DAILY_REPORT" または "KY" のどちらか一語だけを出力してください
(説明文は一切不要です)。
- DAILY_REPORT: その日の作業内容・作業員数・使用機械・時間・天候などを報告する内容(作業日報)
- KY: これから行う作業の危険ポイント・注意点を予知する内容(危険予知活動、KY活動)
判断に迷う場合は必ず DAILY_REPORT としてください。`;

  const raw = (await callAnthropic(system, rawText)).trim();
  return raw.includes("KY") ? "KY" : "DAILY_REPORT";
}

export type KyItem = { risk: string; countermeasure: string };

// 作業内容に含まれるキーワードから、一般的な危険ポイント・対策の候補を返す辞書。
// 「安全確認できていないことを断定しない」ため、一致しなければ何も付け足さず
// 呼び出し側で空欄(人間が入力する前提)として扱うこと。
const KY_RULES: { keyword: string; risk: string; countermeasure: string }[] = [
  { keyword: "バックホウ", risk: "重機との接触・巻き込まれ", countermeasure: "誘導員を配置し、作業半径内への立入りを禁止する" },
  { keyword: "ユンボ", risk: "重機との接触・巻き込まれ", countermeasure: "誘導員を配置し、作業半径内への立入りを禁止する" },
  { keyword: "クレーン", risk: "吊荷の落下・重機との接触", countermeasure: "作業半径内を立入禁止とし、合図者を配置する" },
  { keyword: "掘削", risk: "土砂崩壊による埋没", countermeasure: "適切な勾配を確保し、必要に応じて土留めを設置する" },
  { keyword: "型枠", risk: "墜落・転落、資材の落下", countermeasure: "足場の点検を行い、安全帯を使用する" },
  { keyword: "足場", risk: "墜落・転落", countermeasure: "手すり・幅木を設置し、安全帯を使用する" },
  { keyword: "高所", risk: "墜落・転落", countermeasure: "安全帯を着用し、要所に手すり・囲いを設置する" },
  { keyword: "ダンプ", risk: "後退時の接触・巻き込まれ", countermeasure: "誘導員を配置し、後退時は必ず合図を確認する" },
  { keyword: "電線", risk: "感電", countermeasure: "電力会社・関係者に確認し、絶縁防護措置を行う" },
  { keyword: "交通", risk: "第三者・通行車両との接触", countermeasure: "交通誘導員を配置し、保安施設を設置する" },
  { keyword: "舗装", risk: "高温の材料による火傷", countermeasure: "保護具を着用し、周囲への飛散に注意する" },
  { keyword: "溶接", risk: "火傷・火災", countermeasure: "消火器を準備し、周囲の可燃物を除去する" },
];

/**
 * 作業内容のテキストから、危険予知(KY)の候補をキーワード一致で提案する。
 * 一致するキーワードが無い場合は空の1行を返す(「異常なし」等を勝手に作らない)。
 * 返す内容は必ず現場責任者が確認・修正してから確定すること(REQUIREMENTS.md)。
 */
export async function draftKyItems(workContent: string): Promise<KyItem[]> {
  const matched = KY_RULES.filter((r) => workContent.includes(r.keyword));
  if (matched.length === 0) return [{ risk: "", countermeasure: "" }];

  // 同じキーワード系統の重複(バックホウ/ユンボ等)を除いて返す
  const seen = new Set<string>();
  return matched
    .filter((r) => {
      if (seen.has(r.risk)) return false;
      seen.add(r.risk);
      return true;
    })
    .map((r) => ({ risk: r.risk, countermeasure: r.countermeasure }));
}

// 施工計画書の固定章立て(REQUIREMENTS.md 施工計画書機能の必須仕様)
export const CONSTRUCTION_PLAN_SECTIONS: { key: string; title: string }[] = [
  { key: "overview", title: "工事概要" },
  { key: "policy", title: "施工方針" },
  { key: "method", title: "施工方法" },
  { key: "procedure", title: "施工手順" },
  { key: "schedule", title: "工程管理" },
  { key: "quality", title: "品質管理" },
  { key: "finishedForm", title: "出来形管理" },
  { key: "safety", title: "安全管理" },
  { key: "traffic", title: "交通管理" },
  { key: "environment", title: "環境対策" },
  { key: "byproduct", title: "建設副産物管理" },
  { key: "emergency", title: "緊急時対応" },
  { key: "machinery", title: "使用機械" },
  { key: "organization", title: "施工体制" },
  { key: "materials", title: "資材管理" },
  { key: "orgChart", title: "現場組織表" },
  { key: "flow", title: "施工フロー" },
];

/**
 * 施工計画書の各章について、ユーザーが入力した箇条書きメモを文章として整形する。
 *
 * 重要: これは「文章の整形」のみを行い、記載されていない施工方法・数値・法令等を
 * 新たに作り出すことはしない(REQUIREMENTS.md「根拠資料がない事項は断定しない」)。
 * 常に status=NEEDS_CONFIRMATION として返し、内容の正確性は必ず人間が確認する
 * ことを前提とする。
 */
export async function draftConstructionPlanSection(
  sectionTitle: string,
  memo: string
): Promise<{ content: string; assumedItems: string[] }> {
  const bullets = memo
    .split(/\r?\n|、/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (bullets.length === 0) {
    return { content: "", assumedItems: [] };
  }

  const content = `${sectionTitle}について、以下のとおり計画する。\n` + bullets.map((b) => `・${b}`).join("\n");

  return {
    content,
    assumedItems: [
      "この文章は入力メモをAIが箇条書きから整形しただけであり、内容(数値・工法・法令適合性等)の正確性は未確認です。提出前に必ず人間が確認してください。",
    ],
  };
}
