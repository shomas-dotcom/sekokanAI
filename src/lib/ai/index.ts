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
