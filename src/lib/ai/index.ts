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
  // AI_API_KEY設定後にここへ実際のAI呼び出しを実装する。
  return mockDraftQuoteItems(freeText, rateMaster);
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
  // AI_API_KEY設定後にここへ実際のAI呼び出しを実装する。
  return mockDraftDailyReport(rawText);
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
