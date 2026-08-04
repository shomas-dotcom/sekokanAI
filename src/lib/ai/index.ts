// AI抽象化レイヤー。AI_API_KEY未設定時はモック実装で動作する(ARCHITECTURE.md参照)。
// 特定ベンダーへの依存を避けるため、呼び出し側はこのモジュールの関数のみを利用する。

export type DraftQuoteItem = {
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string;
  unitPriceHint: number | null; // 参考値。確定単価としては使わない(REQUIREMENTS.md)
};

const isMockMode = () => !process.env.AI_API_KEY;

/**
 * 自由記述の工事内容テキストから見積項目の下書きを作成する。
 * 単価は確定させず、常に priceSource=AI_ESTIMATE(参考値)として扱うこと。
 */
export async function draftQuoteItemsFromText(freeText: string): Promise<DraftQuoteItem[]> {
  if (isMockMode()) {
    return mockDraftQuoteItems(freeText);
  }
  // AI_API_KEY設定後にここへ実際のAI呼び出しを実装する。
  return mockDraftQuoteItems(freeText);
}

function mockDraftQuoteItems(freeText: string): DraftQuoteItem[] {
  return freeText
    .split(/\r?\n|、|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      itemName: line,
      spec: null,
      quantity: 1,
      unit: "式",
      unitPriceHint: null,
    }));
}

export type DailyReportDraft = {
  siteName: string | null;
  weather: string | null;
  workerCount: number | null;
  machinery: string | null;
  workContent: string | null;
  quantityWorked: string | null;
  safetyNotes: string | null;
  unclearItems: { field: string; note: string }[];
};

const WEATHER_WORDS = ["晴れ", "曇り", "雨", "雪", "晴天", "曇天"];
const MACHINERY_WORDS = [
  "バックホウ",
  "ブルドーザー",
  "ダンプ",
  "ダンプトラック",
  "クレーン",
  "ローラー",
  "0.25BH",
  "0.45BH",
];

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

  const quantityMatches = [...rawText.matchAll(/(\d+(?:\.\d+)?)\s*(立米|m3|m²|㎡|m)/g)];
  const quantityWorked =
    quantityMatches.length > 0
      ? quantityMatches.map((m) => `${m[1]}${m[2]}`).join("、")
      : null;

  const hasNoIncident = /(事故なし|異常なし|異常はなし|問題なし)/.test(rawText);
  const safetyNotes = hasNoIncident ? "特に異常なし" : null;
  if (!hasNoIncident) unclearItems.push({ field: "安全事項", note: "音声からは特定できませんでした" });

  return {
    siteName,
    weather,
    workerCount,
    machinery,
    workContent: rawText.trim() || null,
    quantityWorked,
    safetyNotes,
    unclearItems,
  };
}
