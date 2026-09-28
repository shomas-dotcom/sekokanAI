// 会社ごとの日報雛形で、表紙(基本情報)シートに書き込める項目の一覧。
// 考え方はquoteTemplateFields.tsと同じ(キーを増やすときはここに追加するだけでよい)。
export const DAILY_REPORT_TEMPLATE_FIELD_KEYS = [
  "COMPANY_NAME",
  "PROJECT_NAME",
  "SITE_ADDRESS",
  "REPORT_DATE",
  "WEATHER",
  "FOREMAN_NAME",
  "WORKER_COUNT",
  "START_TIME",
  "END_TIME",
  "BREAK_MINUTES",
  "WORK_CONTENT",
  "MACHINERY",
  "VEHICLES",
  "MATERIALS",
  "SUBCONTRACTORS",
  "QUANTITY_WORKED",
  "SAFETY_NOTES",
  "DANGER_PREDICTION",
  "NEXT_DAY_PLAN",
  "ISSUES",
  "REMARKS",
] as const;

export type DailyReportTemplateFieldKey = (typeof DAILY_REPORT_TEMPLATE_FIELD_KEYS)[number];

export const DAILY_REPORT_TEMPLATE_FIELD_LABEL: Record<DailyReportTemplateFieldKey, string> = {
  COMPANY_NAME: "自社名",
  PROJECT_NAME: "件名・現場名",
  SITE_ADDRESS: "現場住所",
  REPORT_DATE: "日付",
  WEATHER: "天候",
  FOREMAN_NAME: "職長名",
  WORKER_COUNT: "作業員数",
  START_TIME: "開始時間",
  END_TIME: "終了時間",
  BREAK_MINUTES: "休憩時間(分)",
  WORK_CONTENT: "作業内容",
  MACHINERY: "使用機械",
  VEHICLES: "使用車両",
  MATERIALS: "使用材料",
  SUBCONTRACTORS: "協力会社",
  QUANTITY_WORKED: "出来高数量",
  SAFETY_NOTES: "安全確認",
  DANGER_PREDICTION: "危険予知",
  NEXT_DAY_PLAN: "翌日の予定",
  ISSUES: "課題・連絡事項",
  REMARKS: "備考",
};

export function isDailyReportTemplateFieldKey(value: string): value is DailyReportTemplateFieldKey {
  return (DAILY_REPORT_TEMPLATE_FIELD_KEYS as readonly string[]).includes(value);
}

// 作業員一覧の列に割り当てられる項目。
export const DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS = [
  "workerName",
  "role",
  "startTime",
  "endTime",
  "workDescription",
  "manDays",
] as const;

export type DailyReportTemplateWorkerColumnKey = (typeof DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS)[number];

export const DAILY_REPORT_TEMPLATE_WORKER_COLUMN_LABEL: Record<DailyReportTemplateWorkerColumnKey, string> = {
  workerName: "氏名",
  role: "職種",
  startTime: "開始時間",
  endTime: "終了時間",
  workDescription: "作業内容",
  manDays: "人工",
};

export type DailyReportTemplateFieldMapping = Partial<Record<DailyReportTemplateFieldKey, string>>;
export type DailyReportTemplateWorkerColumns = Partial<Record<DailyReportTemplateWorkerColumnKey, string>>;

const CELL_ADDRESS_RE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const COLUMN_LETTER_RE = /^[A-Z]{1,3}$/;

export function isValidCellAddress(value: string): boolean {
  return CELL_ADDRESS_RE.test(value.trim().toUpperCase());
}

export function isValidColumnLetter(value: string): boolean {
  return COLUMN_LETTER_RE.test(value.trim().toUpperCase());
}

/** 保存されたJSONを安全に読む。壊れている場合は空扱いにする(出力時に例外で落ちないようにする)。 */
export function parseFieldMapping(json: string): DailyReportTemplateFieldMapping {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: DailyReportTemplateFieldMapping = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isDailyReportTemplateFieldKey(key) && typeof value === "string" && isValidCellAddress(value)) {
        result[key] = value.trim().toUpperCase();
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function parseWorkerColumns(json: string): DailyReportTemplateWorkerColumns {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: DailyReportTemplateWorkerColumns = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        (DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS as readonly string[]).includes(key) &&
        typeof value === "string" &&
        isValidColumnLetter(value)
      ) {
        result[key as DailyReportTemplateWorkerColumnKey] = value.trim().toUpperCase();
      }
    }
    return result;
  } catch {
    return {};
  }
}
