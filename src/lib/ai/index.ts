// AI抽象化レイヤー。AI_API_KEY未設定時はモック実装で動作する(ARCHITECTURE.md参照)。
// 特定ベンダーへの依存を避けるため、呼び出し側はこのモジュールの関数のみを利用する。

import { normalizeExtractedText } from "@/lib/textNormalize";
import { recordAiUsage, type AiUsageContext } from "@/lib/aiUsageLog";

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

async function callAnthropic(
  system: string,
  userMessage: string,
  usageContext?: AiUsageContext
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set");

  try {
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

    const data = (await response.json()) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.[0]?.text;
    if (typeof text !== "string") throw new Error("Unexpected Anthropic response shape");

    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: true,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    });
    return text;
  } catch (err) {
    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// 名刺・身分証等の画像を直接読ませる呼び出し。AnthropicのMessages APIは
// 画像をbase64でcontentブロックに含める形式に対応している(mediaTypeは
// image/jpeg・image/png・image/webp・image/gifのみ。HEIC等は事前に弾く
// ことをvalidateVisionImageFile側で保証する前提)。
async function callAnthropicVision(
  system: string,
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  userText: string,
  usageContext?: AiUsageContext
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set");

  try {
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
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API error: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.[0]?.text;
    if (typeof text !== "string") throw new Error("Unexpected Anthropic response shape");

    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: true,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    });
    return text;
  } catch (err) {
    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// PDFを直接読ませる呼び出し。Anthropic Messages APIはPDFをdocumentタイプの
// contentブロックとしてbase64で渡すとテキスト抽出/OCR込みで内容を理解できるため、
// 別途PDF解析ライブラリを追加する必要がない(依存を増やさない方針を維持できる)。
async function callAnthropicDocument(
  system: string,
  base64Pdf: string,
  userText: string,
  usageContext?: AiUsageContext
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set");

  try {
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
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Anthropic API error: ${response.status} ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.[0]?.text;
    if (typeof text !== "string") throw new Error("Unexpected Anthropic response shape");

    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: true,
      inputTokens: data.usage?.input_tokens ?? null,
      outputTokens: data.usage?.output_tokens ?? null,
    });
    return text;
  } catch (err) {
    await recordAiUsage(usageContext, {
      model: ANTHROPIC_MODEL,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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
  freeTextRaw: string,
  rateMaster: RateMasterCandidate[] = [],
  usageContext?: AiUsageContext
): Promise<DraftQuoteItem[]> {
  const freeText = normalizeExtractedText(freeTextRaw);
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockDraftQuoteItems(freeText, rateMaster);
  }
  try {
    return await aiDraftQuoteItems(freeText, rateMaster, usageContext);
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
  rateMaster: RateMasterCandidate[],
  usageContext?: AiUsageContext
): Promise<DraftQuoteItem[]> {
  const system = `あなたは建設工事の見積書作成を補助するアシスタントです。
与えられた工事内容の自由記述テキストから、見積の明細候補を抽出してください。
必ずJSON配列のみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
各要素は次の形式にしてください: {"itemName": string, "spec": string または null, "quantity": number, "unit": string}
単価・金額・原価は絶対に含めないでください(それらは別の仕組みで会社の単価表と突き合わせます)。
数量・単位が文中に明記されていない場合は quantity を 1、unit を "式" としてください。`;

  const raw = await callAnthropic(system, freeText, usageContext);
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
export async function draftDailyReportFromText(
  rawTextInput: string,
  usageContext?: AiUsageContext
): Promise<DailyReportDraft> {
  const rawText = normalizeExtractedText(rawTextInput);
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockDraftDailyReport(rawText);
  }
  try {
    return await aiDraftDailyReport(rawText, usageContext);
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
async function aiDraftDailyReport(
  rawText: string,
  usageContext?: AiUsageContext
): Promise<DailyReportDraft> {
  const system = `あなたは建設現場の作業日報作成を補助するアシスタントです。
与えられた音声認識結果(またはテキスト)から、日報の項目を抽出してください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"siteName": string|null, "weather": string|null, "workerCount": number|null, "machinery": string|null, "vehicles": string|null, "quantityWorked": string|null, "safetyNotes": string|null, "foremanName": string|null, "startTime": string|null, "endTime": string|null, "dangerPrediction": string|null, "nextDayPlan": string|null}
startTime/endTimeは"HH:mm"形式にしてください。
最も重要な注意: 文中に明確に述べられていない項目は、絶対に推測で埋めずnullにしてください。
「異常なし」「良好」等、確認できていない安全確認の結果を勝手に作らないでください。`;

  const raw = await callAnthropic(system, rawText, usageContext);
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

  // normalizeExtractedText(NFKC)により ㎡→"m2"、㎥→"m3"、m²→"m2" に揃っているが、
  // 念のため元の表記(㎡・㎥・m²等)にも対応しておく。"m2"/"m3"を先に判定しないと
  // 単独の"m"に先にマッチしてしまい末尾の数字を読み落とす(例: "25m2"→"25m"になる)。
  const quantityMatches = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*(立米|m3|m2|m³|m²|㎡|㎥|m)/g)];
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

// ダッシュボードの「何でも音声で話す」窓口が、話した内容を日報・KY(危険予知)・
// 顧客登録・従業員登録・案件依頼のどれに振り分けるかを判定する。どれとも言い切れない
// 内容(挨拶のみ・意味不明瞭等)は日報側に倒す(現場で最も使う頻度が高く、間違えても
// 内容はそのまま確認・修正できるため)。
export type VoiceIntent = "DAILY_REPORT" | "KY" | "CUSTOMER" | "EMPLOYEE" | "PROJECT_REQUEST";

const KY_INTENT_WORDS = ["危険予知", "ヒヤリハット", "ヒヤリ・ハット", "KY活動", "危険ポイント", "危険予知活動"];
const CUSTOMER_INTENT_WORDS = ["顧客登録", "取引先登録", "会社名は", "御中", "名刺"];
const EMPLOYEE_INTENT_WORDS = ["従業員登録", "作業員登録", "入社", "雇用区分"];
const PROJECT_REQUEST_INTENT_WORDS = ["見積依頼", "工事依頼", "元請", "発注者"];

export async function classifyVoiceIntent(
  rawTextInput: string,
  usageContext?: AiUsageContext
): Promise<VoiceIntent> {
  const rawText = normalizeExtractedText(rawTextInput);
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockClassifyVoiceIntent(rawText);
  }
  try {
    return await aiClassifyVoiceIntent(rawText, usageContext);
  } catch (err) {
    console.error("[ai] classifyVoiceIntent: falling back to mock", err);
    return mockClassifyVoiceIntent(rawText);
  }
}

function mockClassifyVoiceIntent(rawText: string): VoiceIntent {
  if (KY_INTENT_WORDS.some((w) => rawText.includes(w))) return "KY";
  if (CUSTOMER_INTENT_WORDS.some((w) => rawText.includes(w))) return "CUSTOMER";
  if (EMPLOYEE_INTENT_WORDS.some((w) => rawText.includes(w))) return "EMPLOYEE";
  if (PROJECT_REQUEST_INTENT_WORDS.some((w) => rawText.includes(w))) return "PROJECT_REQUEST";
  // 「見積依頼」等の単語が無くても、住所らしき表記+数量・単位の両方が含まれる場合は
  // 見積依頼・工事依頼の文面である可能性が高いと判断する(LINE等の実際の文面は
  // 「見積依頼」と明記しないことが多いため)。
  if (ADDRESS_PATTERN.test(rawText) && QUANTITY_UNIT_PATTERN.test(rawText)) return "PROJECT_REQUEST";
  return "DAILY_REPORT";
}

async function aiClassifyVoiceIntent(
  rawText: string,
  usageContext?: AiUsageContext
): Promise<VoiceIntent> {
  const system = `あなたは建設会社の業務システムの音声入力を振り分けるアシスタントです。
話された内容が次のどれに最も近いか判定し、該当する一語だけを出力してください
(説明文は一切不要です)。
- DAILY_REPORT: その日の作業内容・作業員数・使用機械・時間・天候などを報告する内容(作業日報)
- KY: これから行う作業の危険ポイント・注意点を予知する内容(危険予知活動、KY活動)
- CUSTOMER: 取引先(会社・担当者)を新しく登録するための情報(会社名・担当者名・電話番号等)
- EMPLOYEE: 自社の従業員を新しく登録するための情報(氏名・役職・入社日等)
- PROJECT_REQUEST: 元請や発注者から届いた見積依頼・工事依頼の内容(現場住所・工期・工事内容等)
判断に迷う場合は必ず DAILY_REPORT としてください。`;

  const raw = (await callAnthropic(system, rawText, usageContext)).trim();
  const valid: VoiceIntent[] = ["KY", "CUSTOMER", "EMPLOYEE", "PROJECT_REQUEST", "DAILY_REPORT"];
  return valid.find((v) => raw.includes(v)) ?? "DAILY_REPORT";
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
export async function draftKyItems(workContentRaw: string): Promise<KyItem[]> {
  const workContent = normalizeExtractedText(workContentRaw);
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

// --- 名刺カメラ自動登録(2026-08-28追記) -----------------------------------
//
// 名刺の読み取りは文字抽出そのものにAIが必要な処理であり、他の機能のような
// 「ルールベースのモック」で代用できる性質のものではない。そのため
// AI_API_KEY未設定時は全項目null・confidence="unavailable"を返し、呼び出し側の
// 画面で「AI連携が未設定のため読み取れません」と案内すること(REQUIREMENTS.mdの
// 「AIが判断できない情報を勝手に生成しない」方針に従い、それらしい偽データは作らない)。

// --- 登録フォームの一括音声入力(2026-08-28追記) ---------------------------
//
// 顧客登録は名刺撮影(画像)と音声入力の両方から同じ項目を埋められるようにする。
// 抽出結果の形はBusinessCardExtractionをそのまま使い回す(項目が完全に一致するため)。

export type BusinessCardExtraction = {
  companyName: string | null;
  personName: string | null;
  position: string | null; // 役職
  department: string | null; // 部署名
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  mobilePhone: string | null;
  fax: string | null;
  email: string | null;
  companyUrl: string | null;
  notes: string | null;
  // high: ほぼ全項目を読み取れた / needs_review: 一部しか読み取れなかった(必ず人間の確認が必要)
  // unavailable: AI未設定、またはAI呼び出し自体が失敗した(読み取り不能)
  confidence: "high" | "needs_review" | "unavailable";
};

const EMPTY_BUSINESS_CARD_EXTRACTION: Omit<BusinessCardExtraction, "confidence"> = {
  companyName: null,
  personName: null,
  position: null,
  department: null,
  postalCode: null,
  address: null,
  phone: null,
  mobilePhone: null,
  fax: null,
  email: null,
  companyUrl: null,
  notes: null,
};

const BUSINESS_CARD_SYSTEM = `あなたは日本の建設会社の事務担当者を補助するアシスタントです。
渡された名刺(画像またはPDF)から情報を読み取ってください。縦書き/横書き、日本語/英語、多少傾いた
写真にも対応してください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"companyName": string|null, "personName": string|null, "position": string|null, "department": string|null, "postalCode": string|null, "address": string|null, "phone": string|null, "mobilePhone": string|null, "fax": string|null, "email": string|null, "companyUrl": string|null}
最も重要な注意: 名刺に印字されていない/読み取れない項目は、絶対に推測で埋めずnullにしてください。
電話番号は「TEL」、携帯は「携帯」「Mobile」「Cell」、FAXは「FAX」の表記を手がかりに区別してください。`;

function parseBusinessCardJson(raw: string): BusinessCardExtraction {
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  const fields: Omit<BusinessCardExtraction, "confidence"> = {
    companyName: asStringOrNull(parsed.companyName),
    personName: asStringOrNull(parsed.personName),
    position: asStringOrNull(parsed.position),
    department: asStringOrNull(parsed.department),
    postalCode: asStringOrNull(parsed.postalCode),
    address: asStringOrNull(parsed.address),
    phone: asStringOrNull(parsed.phone),
    mobilePhone: asStringOrNull(parsed.mobilePhone),
    fax: asStringOrNull(parsed.fax),
    email: asStringOrNull(parsed.email),
    companyUrl: asStringOrNull(parsed.companyUrl),
    notes: null,
  };

  // 会社名・氏名のどちらも読めなかった場合は、実質的に使い物にならない結果として
  // 明示的に「要確認」を強く伝える(needs_review)。それ以外は主要項目の充足度で判定する。
  const coreFieldsFilled = [fields.companyName, fields.personName, fields.phone, fields.email].filter(
    Boolean
  ).length;
  const confidence: BusinessCardExtraction["confidence"] = coreFieldsFilled >= 3 ? "high" : "needs_review";

  return { ...fields, confidence };
}

export async function extractBusinessCardFromImage(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  usageContext?: AiUsageContext
): Promise<BusinessCardExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため名刺の読み取りは利用できません",
    });
    return { ...EMPTY_BUSINESS_CARD_EXTRACTION, confidence: "unavailable" };
  }
  try {
    const raw = await callAnthropicVision(
      BUSINESS_CARD_SYSTEM,
      base64Image,
      mediaType,
      "この名刺を読み取ってください。",
      usageContext
    );
    return parseBusinessCardJson(raw);
  } catch (err) {
    console.error("[ai] extractBusinessCardFromImage: failed", err);
    return { ...EMPTY_BUSINESS_CARD_EXTRACTION, confidence: "unavailable" };
  }
}

// 「資料添付」タブ用(名刺をスキャンしたPDF、または名刺付きの資料PDF)。画像版と
// 判定基準・抽出項目は完全に同じにする。
export async function extractBusinessCardFromPdf(
  base64Pdf: string,
  usageContext?: AiUsageContext
): Promise<BusinessCardExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため名刺の読み取りは利用できません",
    });
    return { ...EMPTY_BUSINESS_CARD_EXTRACTION, confidence: "unavailable" };
  }
  try {
    const raw = await callAnthropicDocument(
      BUSINESS_CARD_SYSTEM,
      base64Pdf,
      "この名刺を読み取ってください。",
      usageContext
    );
    return parseBusinessCardJson(raw);
  } catch (err) {
    console.error("[ai] extractBusinessCardFromPdf: failed", err);
    return { ...EMPTY_BUSINESS_CARD_EXTRACTION, confidence: "unavailable" };
  }
}

// 現場写真の「施工前/中/後」「コメント」のAI提案(日報の写真帳機能用)。
// あくまで提案であり、アップロード時にユーザーが確認・修正してから保存する
// (uploadPhotoActionは従来どおりユーザーが選んだ値をそのまま保存する。ここでは
// フォームへの仮入力に使う値を返すだけで、DBへの直接書き込みはしない)。
export type PhotoMetadataExtraction = {
  phase: "BEFORE" | "DURING" | "AFTER" | "UNKNOWN";
  caption: string | null;
  confidence: "high" | "needs_review" | "unavailable";
};

const PHOTO_METADATA_SYSTEM = `あなたは建設現場の写真を確認する事務担当者を補助するアシスタントです。
渡された写真を見て、次の2つだけを判定してください。
1. phase: この写真が「施工前」「施工中」「施工後」のどれに近いか。判断がつかない場合はUNKNOWNにしてください。
2. caption: 写真に写っている作業内容を20文字程度の日本語で一言にしてください。判断できない場合はnullにしてください。
金額の見積もり・安全性の良し悪し・工事の完成度の評価はしないでください。写真から読み取れないことは書かないでください。
必ずJSONオブジェクトのみを出力してください。形式: {"phase": "BEFORE"|"DURING"|"AFTER"|"UNKNOWN", "caption": string|null}`;

const VALID_PHOTO_PHASES = ["BEFORE", "DURING", "AFTER", "UNKNOWN"] as const;

function parsePhotoMetadataJson(raw: string): PhotoMetadataExtraction {
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const phaseRaw = typeof parsed.phase === "string" ? parsed.phase.toUpperCase() : "UNKNOWN";
  const phase = (VALID_PHOTO_PHASES as readonly string[]).includes(phaseRaw)
    ? (phaseRaw as PhotoMetadataExtraction["phase"])
    : "UNKNOWN";
  const caption = typeof parsed.caption === "string" && parsed.caption.trim() ? parsed.caption.trim() : null;

  // 施工段階・コメントのどちらも読み取れなかった場合は「要確認」を強く伝える
  const confidence: PhotoMetadataExtraction["confidence"] =
    phase !== "UNKNOWN" && caption ? "high" : "needs_review";

  return { phase, caption, confidence };
}

export async function suggestPhotoMetadataFromImage(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  usageContext?: AiUsageContext
): Promise<PhotoMetadataExtraction> {
  if (isMockMode()) {
    // 写真の中身を判定する処理は本物の画像認識AIが無いと精度を出せないため、
    // 名刺・身分証読み取りと同じ方針で「不明」を正直に返す(それらしい値を作らない)。
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため写真の判定は利用できません",
    });
    return { phase: "UNKNOWN", caption: null, confidence: "unavailable" };
  }
  try {
    const raw = await callAnthropicVision(
      PHOTO_METADATA_SYSTEM,
      base64Image,
      mediaType,
      "この現場写真を確認してください。",
      usageContext
    );
    return parsePhotoMetadataJson(raw);
  } catch (err) {
    console.error("[ai] suggestPhotoMetadataFromImage: failed", err);
    return { phase: "UNKNOWN", caption: null, confidence: "unavailable" };
  }
}

// 電話・メールアドレスは正規表現だけでも十分実用的に取れるため、名刺OCRと違い
// AI未設定時でもルールベースのモックで代用する(REQUIREMENTS.mdの
// 「単価等それ自体を推測で作らない」対象ではなく、単なる書式抽出のため)。
const PHONE_PATTERN = /(0\d{1,4}-\d{1,4}-\d{3,4})/;
const MOBILE_PATTERN = /(0[7-9]0-\d{4}-\d{4})/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;

function extractPrefixed(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[はが:：]?\\s*([^\\s、。]+)`));
    if (match) return match[1];
  }
  return null;
}

export async function extractCustomerFieldsFromText(
  text: string,
  usageContext?: AiUsageContext
): Promise<BusinessCardExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockExtractCustomerFields(text);
  }
  try {
    return await aiExtractCustomerFields(text, usageContext);
  } catch (err) {
    console.error("[ai] extractCustomerFieldsFromText: falling back to mock", err);
    return mockExtractCustomerFields(text);
  }
}

function mockExtractCustomerFields(rawText: string): BusinessCardExtraction {
  const mobileMatch = rawText.match(MOBILE_PATTERN);
  const phoneMatch = rawText.match(PHONE_PATTERN);
  // 携帯番号(070/080/090)は電話番号のパターンにも一致してしまうため、携帯として
  // 一度取れたら電話番号側からは除外する
  const phone = phoneMatch && phoneMatch[0] !== mobileMatch?.[0] ? phoneMatch[0] : null;

  const fields: Omit<BusinessCardExtraction, "confidence"> = {
    companyName: extractPrefixed(rawText, ["会社名", "会社", "御中"]),
    personName: extractPrefixed(rawText, ["担当者", "担当", "氏名", "名前"]),
    position: extractPrefixed(rawText, ["役職"]),
    department: extractPrefixed(rawText, ["部署"]),
    postalCode: extractPrefixed(rawText, ["郵便番号"]),
    address: extractPrefixed(rawText, ["住所"]),
    phone,
    mobilePhone: mobileMatch?.[0] ?? null,
    fax: extractPrefixed(rawText, ["FAX", "ファックス"]),
    email: rawText.match(EMAIL_PATTERN)?.[0] ?? null,
    companyUrl: extractPrefixed(rawText, ["URL", "ホームページ", "サイト"]),
    notes: null,
  };
  const coreFieldsFilled = [fields.companyName, fields.personName, fields.phone, fields.email].filter(
    Boolean
  ).length;
  return { ...fields, confidence: coreFieldsFilled >= 2 ? "high" : "needs_review" };
}

async function aiExtractCustomerFields(
  text: string,
  usageContext?: AiUsageContext
): Promise<BusinessCardExtraction> {
  const system = `あなたは建設会社の事務担当者を補助するアシスタントです。
話し言葉または自由記述のテキストから、取引先の情報を読み取ってください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"companyName": string|null, "personName": string|null, "position": string|null, "department": string|null, "postalCode": string|null, "address": string|null, "phone": string|null, "mobilePhone": string|null, "fax": string|null, "email": string|null, "companyUrl": string|null}
最も重要な注意: 文中に述べられていない項目は、絶対に推測で埋めずnullにしてください。`;

  const raw = await callAnthropic(system, text, usageContext);
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const fields: Omit<BusinessCardExtraction, "confidence"> = {
    companyName: asStringOrNull(parsed.companyName),
    personName: asStringOrNull(parsed.personName),
    position: asStringOrNull(parsed.position),
    department: asStringOrNull(parsed.department),
    postalCode: asStringOrNull(parsed.postalCode),
    address: asStringOrNull(parsed.address),
    phone: asStringOrNull(parsed.phone),
    mobilePhone: asStringOrNull(parsed.mobilePhone),
    fax: asStringOrNull(parsed.fax),
    email: asStringOrNull(parsed.email),
    companyUrl: asStringOrNull(parsed.companyUrl),
    notes: null,
  };
  const coreFieldsFilled = [fields.companyName, fields.personName, fields.phone, fields.email].filter(
    Boolean
  ).length;
  return { ...fields, confidence: coreFieldsFilled >= 2 ? "high" : "needs_review" };
}

export type EmployeeFieldExtraction = {
  name: string | null;
  nameKana: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  confidence: "high" | "needs_review";
};

export async function extractEmployeeFieldsFromText(
  text: string,
  usageContext?: AiUsageContext
): Promise<EmployeeFieldExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockExtractEmployeeFields(text);
  }
  try {
    return await aiExtractEmployeeFields(text, usageContext);
  } catch (err) {
    console.error("[ai] extractEmployeeFieldsFromText: falling back to mock", err);
    return mockExtractEmployeeFields(text);
  }
}

function mockExtractEmployeeFields(rawText: string): EmployeeFieldExtraction {
  const fields: Omit<EmployeeFieldExtraction, "confidence"> = {
    name: extractPrefixed(rawText, ["氏名", "名前"]),
    nameKana: extractPrefixed(rawText, ["フリガナ", "ふりがな"]),
    position: extractPrefixed(rawText, ["役職"]),
    email: rawText.match(EMAIL_PATTERN)?.[0] ?? null,
    phone: rawText.match(MOBILE_PATTERN)?.[0] ?? rawText.match(PHONE_PATTERN)?.[0] ?? null,
    notes: null,
  };
  return { ...fields, confidence: fields.name ? "high" : "needs_review" };
}

async function aiExtractEmployeeFields(
  text: string,
  usageContext?: AiUsageContext
): Promise<EmployeeFieldExtraction> {
  const system = `あなたは建設会社の事務担当者を補助するアシスタントです。
話し言葉または自由記述のテキストから、従業員の情報を読み取ってください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"name": string|null, "nameKana": string|null, "position": string|null, "email": string|null, "phone": string|null}
最も重要な注意: 文中に述べられていない項目は、絶対に推測で埋めずnullにしてください。`;

  const raw = await callAnthropic(system, text, usageContext);
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const asStringOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const fields: Omit<EmployeeFieldExtraction, "confidence"> = {
    name: asStringOrNull(parsed.name),
    nameKana: asStringOrNull(parsed.nameKana),
    position: asStringOrNull(parsed.position),
    email: asStringOrNull(parsed.email),
    phone: asStringOrNull(parsed.phone),
    notes: null,
  };
  return { ...fields, confidence: fields.name ? "high" : "needs_review" };
}

// --- 案件依頼のAI自動解析(2026-08-28追記) ---------------------------------
//
// 元請会社等からの見積依頼(文章・画像・PDF)を読み取り、案件登録欄への仮入力を
// 作る。読み取れなかった項目はunclearFieldsに積み、勝手に埋めない
// (REQUIREMENTS.mdの一貫した方針)。年が書かれていない日付はAIに無理な推測を
// させず、periodTextにそのまま残すよう指示する。

export type ProjectRequestExtraction = {
  projectName: string | null;
  customerName: string | null; // 顧客名(会社名)。既存顧客との突き合わせは呼び出し側で行う
  primeContractorName: string | null; // 元請会社
  siteAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  periodText: string | null; // 工期の原文表記(年が不明な場合もそのまま残す)
  startDate: string | null; // YYYY-MM-DD。年まで確定できた場合のみ
  endDate: string | null;
  castingDate: string | null; // 打設日
  workContent: string | null;
  quantity: string | null;
  suppliedItems: string | null;
  soilQuantity: string | null;
  cautions: string | null;
  unclearFields: string[];
  confidence: "high" | "needs_review" | "unavailable";
};

const PROJECT_REQUEST_FIELD_LABEL: Record<string, string> = {
  projectName: "案件名",
  customerName: "顧客名",
  siteAddress: "現場住所",
  workContent: "工事内容",
};

const PROJECT_REQUEST_SYSTEM = `あなたは建設会社の事務担当者を補助するアシスタントです。
元請会社等から届いた見積依頼・工事依頼の内容(文章または画像)から、案件登録に使う情報を読み取ってください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"projectName": string|null, "customerName": string|null, "primeContractorName": string|null, "siteAddress": string|null, "contactName": string|null, "contactPhone": string|null, "periodText": string|null, "startDate": string|null, "endDate": string|null, "castingDate": string|null, "workContent": string|null, "quantity": string|null, "suppliedItems": string|null, "soilQuantity": string|null, "cautions": string|null}
最も重要な注意:
- 文中(画像内)に明記されていない項目は、絶対に推測で埋めずnullにしてください。
- startDate/endDate/castingDateは西暦のYYYY-MM-DD形式にしてください。年が書かれておらず
  西暦を確定できない場合は、これらをnullのままにし、periodTextに原文の日付表記
  (例:「9月5日」)をそのまま残してください(年を勝手に補完しないこと)。
- quantityには単位を含めた原文表記をそのまま入れてください(例:「土間コン30㎡、残土10m3」)。`;

function parseProjectRequestJson(raw: string): Omit<ProjectRequestExtraction, "confidence" | "unclearFields"> {
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");
  const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    projectName: s(parsed.projectName),
    customerName: s(parsed.customerName),
    primeContractorName: s(parsed.primeContractorName),
    siteAddress: s(parsed.siteAddress),
    contactName: s(parsed.contactName),
    contactPhone: s(parsed.contactPhone),
    periodText: s(parsed.periodText),
    startDate: s(parsed.startDate),
    endDate: s(parsed.endDate),
    castingDate: s(parsed.castingDate),
    workContent: s(parsed.workContent),
    quantity: s(parsed.quantity),
    suppliedItems: s(parsed.suppliedItems),
    soilQuantity: s(parsed.soilQuantity),
    cautions: s(parsed.cautions),
  };
}

function finalizeProjectRequestExtraction(
  fields: Omit<ProjectRequestExtraction, "confidence" | "unclearFields">
): ProjectRequestExtraction {
  const unclearFields = Object.entries(PROJECT_REQUEST_FIELD_LABEL)
    .filter(([key]) => (fields as unknown as Record<string, unknown>)[key] == null)
    .map(([, label]) => label);
  const coreFieldsFilled = [fields.projectName, fields.customerName, fields.siteAddress, fields.workContent].filter(
    Boolean
  ).length;
  const confidence: ProjectRequestExtraction["confidence"] = coreFieldsFilled >= 2 ? "high" : "needs_review";
  return { ...fields, unclearFields, confidence };
}

const UNAVAILABLE_PROJECT_REQUEST: ProjectRequestExtraction = {
  projectName: null,
  customerName: null,
  primeContractorName: null,
  siteAddress: null,
  contactName: null,
  contactPhone: null,
  periodText: null,
  startDate: null,
  endDate: null,
  castingDate: null,
  workContent: null,
  quantity: null,
  suppliedItems: null,
  soilQuantity: null,
  cautions: null,
  unclearFields: Object.values(PROJECT_REQUEST_FIELD_LABEL),
  confidence: "unavailable",
};

export async function extractProjectRequestFromText(
  text: string,
  usageContext?: AiUsageContext
): Promise<ProjectRequestExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockExtractProjectRequest(text);
  }
  try {
    const raw = await callAnthropic(PROJECT_REQUEST_SYSTEM, text, usageContext);
    return finalizeProjectRequestExtraction(parseProjectRequestJson(raw));
  } catch (err) {
    console.error("[ai] extractProjectRequestFromText: falling back to mock", err);
    return mockExtractProjectRequest(text);
  }
}

export async function extractProjectRequestFromImage(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  usageContext?: AiUsageContext
): Promise<ProjectRequestExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため画像の読み取りは利用できません",
    });
    return UNAVAILABLE_PROJECT_REQUEST;
  }
  try {
    const raw = await callAnthropicVision(
      PROJECT_REQUEST_SYSTEM,
      base64Image,
      mediaType,
      "この画像の依頼内容を読み取ってください。",
      usageContext
    );
    return finalizeProjectRequestExtraction(parseProjectRequestJson(raw));
  } catch (err) {
    console.error("[ai] extractProjectRequestFromImage: failed", err);
    return UNAVAILABLE_PROJECT_REQUEST;
  }
}

export async function extractProjectRequestFromPdf(
  base64Pdf: string,
  usageContext?: AiUsageContext
): Promise<ProjectRequestExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のためPDFの読み取りは利用できません",
    });
    return UNAVAILABLE_PROJECT_REQUEST;
  }
  try {
    const raw = await callAnthropicDocument(
      PROJECT_REQUEST_SYSTEM,
      base64Pdf,
      "このPDFの依頼内容を読み取ってください。",
      usageContext
    );
    return finalizeProjectRequestExtraction(parseProjectRequestJson(raw));
  } catch (err) {
    console.error("[ai] extractProjectRequestFromPdf: failed", err);
    return UNAVAILABLE_PROJECT_REQUEST;
  }
}

// 「○○市○○町」のような住所表記を拾う簡易パターン(市区町村までの部分一致)
const ADDRESS_PATTERN = /([一-龠ぁ-んァ-ヶA-Za-z0-9]{2,10}[都道府県]?[一-龠ぁ-んァ-ヶ]{1,6}[市区町村][一-龠ぁ-んァ-ヶ0-90-9丁目番地の\-－]*)/;
const PERIOD_PATTERN = /(\d{1,2}月\d{1,2}日)\s*[~〜\-−]\s*(\d{1,2}月\d{1,2}日)/;

function mockExtractProjectRequest(rawText: string): ProjectRequestExtraction {
  const periodMatch = rawText.match(PERIOD_PATTERN);
  const fields: Omit<ProjectRequestExtraction, "confidence" | "unclearFields"> = {
    projectName: null, // モックでは案件名を断定せず、常に人間の確認候補にする
    customerName: extractPrefixed(rawText, ["元請", "発注者", "顧客"]),
    primeContractorName: extractPrefixed(rawText, ["元請"]),
    siteAddress: rawText.match(ADDRESS_PATTERN)?.[0] ?? null,
    contactName: extractPrefixed(rawText, ["担当者", "担当"]),
    contactPhone: rawText.match(MOBILE_PATTERN)?.[0] ?? rawText.match(PHONE_PATTERN)?.[0] ?? null,
    periodText: periodMatch ? periodMatch[0] : null,
    startDate: null, // 年が不明な原文がほとんどのため、モックでは断定しない
    endDate: null,
    castingDate: null,
    workContent: rawText.trim() || null, // 何も構造化できなくても原文は工事内容の手がかりとして残す
    quantity: null,
    suppliedItems: extractPrefixed(rawText, ["支給品"]),
    soilQuantity: rawText.match(/残土\s*(\d+(?:\.\d+)?\s*m3)/)?.[1] ?? null,
    cautions: null,
  };
  return finalizeProjectRequestExtraction(fields);
}

// --- 身分証からの従業員自動登録(2026-08-29追記) -----------------------------
//
// 運転免許証・マイナンバーカード等を読み取る。画像そのものは呼び出し側で保存
// しない前提(REQUIREMENTS.mdの「必要以上の個人情報を保存しない」方針)。
// 生年月日・住所・免許証番号は確認画面に一度だけ表示する目的の情報であり、
// DBへの恒久保存は行わない(氏名・フリガナと、免許の種類・有効期限だけを
// 既存の「保有資格」として登録する。これにより新たな個人情報用カラムを
// 増やさずに済む)。名刺OCRと同様、これも文字抽出そのものにAIが必要なため
// モックでの代替はできない。

export type IdCardExtraction = {
  name: string | null;
  nameKana: string | null;
  dateOfBirth: string | null; // 確認画面表示のみ。DBには保存しない
  address: string | null; // 確認画面表示のみ。DBには保存しない
  licenseNumber: string | null; // 確認画面表示のみ。DBには保存しない
  licenseType: string | null; // 保有資格として登録する(例: "普通自動車第一種運転免許")
  licenseExpiry: string | null; // 保有資格の有効期限として登録する(YYYY-MM-DD)
  confidence: "high" | "needs_review" | "unavailable";
};

const ID_CARD_SYSTEM = `あなたは建設会社の事務担当者を補助するアシスタントです。
渡された身分証(運転免許証・マイナンバーカード等)の画像から情報を読み取ってください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式: {"name": string|null, "nameKana": string|null, "dateOfBirth": string|null, "address": string|null, "licenseNumber": string|null, "licenseType": string|null, "licenseExpiry": string|null}
日付は西暦のYYYY-MM-DD形式にしてください(和暦が書かれている場合は西暦に変換してください)。
最も重要な注意: 記載されていない/読み取れない項目は、絶対に推測で埋めずnullにしてください。`;

function parseIdCardJson(raw: string): Omit<IdCardExtraction, "confidence"> {
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");
  const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    name: s(parsed.name),
    nameKana: s(parsed.nameKana),
    dateOfBirth: s(parsed.dateOfBirth),
    address: s(parsed.address),
    licenseNumber: s(parsed.licenseNumber),
    licenseType: s(parsed.licenseType),
    licenseExpiry: s(parsed.licenseExpiry),
  };
}

const UNAVAILABLE_ID_CARD: IdCardExtraction = {
  name: null,
  nameKana: null,
  dateOfBirth: null,
  address: null,
  licenseNumber: null,
  licenseType: null,
  licenseExpiry: null,
  confidence: "unavailable",
};

function finalizeIdCardExtraction(fields: Omit<IdCardExtraction, "confidence">): IdCardExtraction {
  return { ...fields, confidence: fields.name ? "high" : "needs_review" };
}

export async function extractIdCardFromImage(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  usageContext?: AiUsageContext
): Promise<IdCardExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため身分証の読み取りは利用できません",
    });
    return UNAVAILABLE_ID_CARD;
  }
  try {
    const raw = await callAnthropicVision(
      ID_CARD_SYSTEM,
      base64Image,
      mediaType,
      "この身分証を読み取ってください。",
      usageContext
    );
    return finalizeIdCardExtraction(parseIdCardJson(raw));
  } catch (err) {
    console.error("[ai] extractIdCardFromImage: failed", err);
    return UNAVAILABLE_ID_CARD;
  }
}

export async function extractIdCardFromPdf(
  base64Pdf: string,
  usageContext?: AiUsageContext
): Promise<IdCardExtraction> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため身分証の読み取りは利用できません",
    });
    return UNAVAILABLE_ID_CARD;
  }
  try {
    const raw = await callAnthropicDocument(
      ID_CARD_SYSTEM,
      base64Pdf,
      "この身分証を読み取ってください。",
      usageContext
    );
    return finalizeIdCardExtraction(parseIdCardJson(raw));
  } catch (err) {
    console.error("[ai] extractIdCardFromPdf: failed", err);
    return UNAVAILABLE_ID_CARD;
  }
}

// --- AIかんたん登録(統合受付、2026-08-29追記) -------------------------------
//
// ダッシュボードの「AIかんたん登録」窓口。渡された内容(画像・PDF・テキスト)の
// 種類を1回のAI呼び出しで判定し、該当する情報(顧客/案件/従業員)を抽出する。
// 見積書・契約書・請求書は「顧客・案件情報の抽出」までを対象とし、明細行・
// 契約条項・請求金額そのものの抽出は対象外(単価履歴機能や見積AI機能の
// 別作業とする。ここで無理に手を広げてAIに金額を確定させることは絶対にしない)。

export type AiIntakeDocumentType =
  | "business_card"
  | "estimate_request"
  | "estimate"
  | "contract"
  | "invoice"
  | "employee_id"
  | "project_message"
  | "unknown";

export type AiIntakeResult = {
  documentType: AiIntakeDocumentType;
  customer: BusinessCardExtraction | null;
  project: ProjectRequestExtraction | null;
  employee: IdCardExtraction | null;
  confidence: "high" | "needs_review" | "unavailable";
};

const UNAVAILABLE_INTAKE: AiIntakeResult = {
  documentType: "unknown",
  customer: null,
  project: null,
  employee: null,
  confidence: "unavailable",
};

const AI_INTAKE_SYSTEM = `あなたは建設会社の受付AIです。渡された資料(名刺・見積依頼・見積書・契約書・
請求書・身分証・LINEやメール等の文面のいずれか)の種類を判定し、該当する情報を抽出してください。
必ずJSONオブジェクトのみを出力してください(説明文・前置き・コードブロックの外側の文章は一切不要です)。
形式:
{
  "documentType": "business_card"|"estimate_request"|"estimate"|"contract"|"invoice"|"employee_id"|"project_message"|"unknown",
  "customer": {"companyName":string|null,"personName":string|null,"position":string|null,"department":string|null,"postalCode":string|null,"address":string|null,"phone":string|null,"mobilePhone":string|null,"fax":string|null,"email":string|null,"companyUrl":string|null} または null,
  "project": {"projectName":string|null,"customerName":string|null,"primeContractorName":string|null,"siteAddress":string|null,"contactName":string|null,"contactPhone":string|null,"periodText":string|null,"startDate":string|null,"endDate":string|null,"castingDate":string|null,"workContent":string|null,"quantity":string|null,"suppliedItems":string|null,"soilQuantity":string|null,"cautions":string|null} または null,
  "employee": {"name":string|null,"nameKana":string|null,"licenseType":string|null,"licenseExpiry":string|null} または null
}
判定基準:
- 名刺(氏名・会社名・役職・連絡先が主) → business_card。customerのみ埋める(project/employeeはnull)
- 元請/施主からの見積依頼・工事依頼の文面(LINE・メール・手書きメモ等含む) → estimate_request または project_message。customerとprojectを可能な範囲で埋める(employeeはnull)
- 金額明細を含む正式な見積書・契約書・請求書 → estimate/contract/invoice。customerとprojectを埋める(明細行・金額そのものはこの場では抽出しない)
- 運転免許証・マイナンバーカード等の身分証 → employee_id。employeeのみ埋める(customer/projectはnull)
- LINE等のチャット画面のスクリーンショットの場合、時刻表示・既読・スタンプ・アプリのUI文字は内容として扱わず、実際のメッセージ本文のみを判定材料にすること
- どれにも当てはまらない、判定できない場合は unknown とし、customer/project/employeeは全てnullにする
最も重要な注意: 記載されていない/読み取れない項目は、絶対に推測で埋めずnullにしてください。
startDate/endDate/castingDateは西暦のYYYY-MM-DD形式にし、年が確定できない場合はnullのままperiodTextに原文を残してください。`;

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseAiIntakeJson(raw: string): AiIntakeResult {
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed) throw new Error("AI response was not valid JSON");

  const documentTypes: AiIntakeDocumentType[] = [
    "business_card",
    "estimate_request",
    "estimate",
    "contract",
    "invoice",
    "employee_id",
    "project_message",
    "unknown",
  ];
  const documentType = documentTypes.includes(parsed.documentType as AiIntakeDocumentType)
    ? (parsed.documentType as AiIntakeDocumentType)
    : "unknown";

  const c = parsed.customer as Record<string, unknown> | null;
  const customer: BusinessCardExtraction | null = c
    ? {
        companyName: asStringOrNull(c.companyName),
        personName: asStringOrNull(c.personName),
        position: asStringOrNull(c.position),
        department: asStringOrNull(c.department),
        postalCode: asStringOrNull(c.postalCode),
        address: asStringOrNull(c.address),
        phone: asStringOrNull(c.phone),
        mobilePhone: asStringOrNull(c.mobilePhone),
        fax: asStringOrNull(c.fax),
        email: asStringOrNull(c.email),
        companyUrl: asStringOrNull(c.companyUrl),
        notes: null,
        confidence: "high",
      }
    : null;

  const p = parsed.project as Record<string, unknown> | null;
  const project: ProjectRequestExtraction | null = p
    ? {
        projectName: asStringOrNull(p.projectName),
        customerName: asStringOrNull(p.customerName),
        primeContractorName: asStringOrNull(p.primeContractorName),
        siteAddress: asStringOrNull(p.siteAddress),
        contactName: asStringOrNull(p.contactName),
        contactPhone: asStringOrNull(p.contactPhone),
        periodText: asStringOrNull(p.periodText),
        startDate: asStringOrNull(p.startDate),
        endDate: asStringOrNull(p.endDate),
        castingDate: asStringOrNull(p.castingDate),
        workContent: asStringOrNull(p.workContent),
        quantity: asStringOrNull(p.quantity),
        suppliedItems: asStringOrNull(p.suppliedItems),
        soilQuantity: asStringOrNull(p.soilQuantity),
        cautions: asStringOrNull(p.cautions),
        unclearFields: [],
        confidence: "high",
      }
    : null;

  const e = parsed.employee as Record<string, unknown> | null;
  const employee: IdCardExtraction | null = e
    ? {
        name: asStringOrNull(e.name),
        nameKana: asStringOrNull(e.nameKana),
        dateOfBirth: null,
        address: null,
        licenseNumber: null,
        licenseType: asStringOrNull(e.licenseType),
        licenseExpiry: asStringOrNull(e.licenseExpiry),
        confidence: "high",
      }
    : null;

  // documentType不明の場合は必ずユーザーに選ばせる(REQUIREMENTS.mdの
  // 「unknownでもエラー終了せず登録先を選択させる」方針)。
  const confidence: AiIntakeResult["confidence"] =
    documentType === "unknown" || (!customer && !project && !employee) ? "needs_review" : "high";

  return { documentType, customer, project, employee, confidence };
}

function mockAnalyzeAiIntakeFromText(text: string): AiIntakeResult {
  const intent = mockClassifyVoiceIntent(text);
  if (intent === "CUSTOMER") {
    return {
      documentType: "business_card",
      customer: mockExtractCustomerFields(text),
      project: null,
      employee: null,
      confidence: "needs_review",
    };
  }
  if (intent === "EMPLOYEE") {
    return { documentType: "employee_id", customer: null, project: null, employee: null, confidence: "unavailable" };
  }
  if (intent === "PROJECT_REQUEST") {
    return {
      documentType: "project_message",
      customer: null,
      project: mockExtractProjectRequest(text),
      employee: null,
      confidence: "needs_review",
    };
  }
  return { ...UNAVAILABLE_INTAKE, confidence: "needs_review" };
}

export async function analyzeAiIntakeFromText(
  text: string,
  usageContext?: AiUsageContext
): Promise<AiIntakeResult> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, { model: "mock", success: true });
    return mockAnalyzeAiIntakeFromText(text);
  }
  try {
    const raw = await callAnthropic(AI_INTAKE_SYSTEM, text, usageContext);
    return parseAiIntakeJson(raw);
  } catch (err) {
    console.error("[ai] analyzeAiIntakeFromText: falling back to mock", err);
    return mockAnalyzeAiIntakeFromText(text);
  }
}

export async function analyzeAiIntakeFromImage(
  base64Image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  usageContext?: AiUsageContext
): Promise<AiIntakeResult> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のため画像の判定は利用できません",
    });
    return UNAVAILABLE_INTAKE;
  }
  try {
    const raw = await callAnthropicVision(
      AI_INTAKE_SYSTEM,
      base64Image,
      mediaType,
      "この画像の種類を判定し、該当する情報を抽出してください。",
      usageContext
    );
    return parseAiIntakeJson(raw);
  } catch (err) {
    console.error("[ai] analyzeAiIntakeFromImage: failed", err);
    return UNAVAILABLE_INTAKE;
  }
}

export async function analyzeAiIntakeFromPdf(
  base64Pdf: string,
  usageContext?: AiUsageContext
): Promise<AiIntakeResult> {
  if (isMockMode()) {
    await recordAiUsage(usageContext, {
      model: "mock",
      success: false,
      errorMessage: "AI_API_KEY未設定のためPDFの判定は利用できません",
    });
    return UNAVAILABLE_INTAKE;
  }
  try {
    const raw = await callAnthropicDocument(
      AI_INTAKE_SYSTEM,
      base64Pdf,
      "このPDFの種類を判定し、該当する情報を抽出してください。",
      usageContext
    );
    return parseAiIntakeJson(raw);
  } catch (err) {
    console.error("[ai] analyzeAiIntakeFromPdf: failed", err);
    return UNAVAILABLE_INTAKE;
  }
}
