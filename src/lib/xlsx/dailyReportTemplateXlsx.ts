import ExcelJS from "exceljs";
import {
  parseFieldMapping,
  parseWorkerColumns,
  type DailyReportTemplateFieldKey,
} from "./dailyReportTemplateFields";

export type DailyReportXlsxWorker = {
  workerName: string;
  role: string | null;
  startTime: string | null;
  endTime: string | null;
  workDescription: string | null;
  manDays: number | null;
};

export type DailyReportXlsxInput = {
  companyName: string;
  projectName: string;
  siteAddress: string | null;
  reportDateText: string; // 例: "2026年09月29日"
  weather: string | null;
  foremanName: string | null;
  workerCount: number | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  workContent: string | null;
  machinery: string | null;
  vehicles: string | null;
  materials: string | null;
  subcontractors: string | null;
  quantityWorked: string | null;
  safetyNotes: string | null;
  dangerPrediction: string | null;
  nextDayPlan: string | null;
  issues: string | null;
  remarks: string | null;
  workers: DailyReportXlsxWorker[];
};

export type DailyReportTemplateVersionInput = {
  fileData: Buffer;
  sheetName: string;
  fieldMappingJson: string;
  workerSheetName: string;
  workerStartRow: number;
  workerMaxRows: number;
  workerColumnsJson: string;
};

/** 登録した会社の雛形が対応できる作業員数を超えている場合に投げる(部分的な出力はしない)。 */
export class DailyReportTemplateTooManyWorkersError extends Error {
  constructor(
    public readonly workerCount: number,
    public readonly workerMaxRows: number
  ) {
    super(`作業員が${workerCount}名おり、この雛形が対応できる${workerMaxRows}名を超えています。`);
    this.name = "DailyReportTemplateTooManyWorkersError";
  }
}

function fieldValue(key: DailyReportTemplateFieldKey, input: DailyReportXlsxInput): string | number | null {
  switch (key) {
    case "COMPANY_NAME":
      return input.companyName;
    case "PROJECT_NAME":
      return input.projectName;
    case "SITE_ADDRESS":
      return input.siteAddress;
    case "REPORT_DATE":
      return input.reportDateText;
    case "WEATHER":
      return input.weather;
    case "FOREMAN_NAME":
      return input.foremanName;
    case "WORKER_COUNT":
      return input.workerCount;
    case "START_TIME":
      return input.startTime;
    case "END_TIME":
      return input.endTime;
    case "BREAK_MINUTES":
      return input.breakMinutes;
    case "WORK_CONTENT":
      return input.workContent;
    case "MACHINERY":
      return input.machinery;
    case "VEHICLES":
      return input.vehicles;
    case "MATERIALS":
      return input.materials;
    case "SUBCONTRACTORS":
      return input.subcontractors;
    case "QUANTITY_WORKED":
      return input.quantityWorked;
    case "SAFETY_NOTES":
      return input.safetyNotes;
    case "DANGER_PREDICTION":
      return input.dangerPrediction;
    case "NEXT_DAY_PLAN":
      return input.nextDayPlan;
    case "ISSUES":
      return input.issues;
    case "REMARKS":
      return input.remarks;
    default:
      return null;
  }
}

/**
 * 会社が登録した日報の雛形(元のExcelファイル)を読み込み、マッピングで指定したセルだけを
 * 書き込んで返す。それ以外の罫線・結合・書式・数式・固定文言はいっさい変更しない。
 * 作りはquoteTemplateXlsx.tsのbuildQuoteXlsxFromTemplateと同じ。
 */
export async function buildDailyReportXlsxFromTemplate(
  version: DailyReportTemplateVersionInput,
  input: DailyReportXlsxInput
): Promise<Buffer<ArrayBuffer>> {
  if (input.workers.length > version.workerMaxRows) {
    throw new DailyReportTemplateTooManyWorkersError(input.workers.length, version.workerMaxRows);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(version.fileData as unknown as ExcelJS.Buffer);

  const coverSheet = wb.getWorksheet(version.sheetName);
  if (!coverSheet) throw new Error(`雛形にシート「${version.sheetName}」が見つかりません。`);
  const workerSheet = wb.getWorksheet(version.workerSheetName);
  if (!workerSheet) throw new Error(`雛形にシート「${version.workerSheetName}」が見つかりません。`);

  const fieldMapping = parseFieldMapping(version.fieldMappingJson);
  for (const [key, address] of Object.entries(fieldMapping)) {
    const value = fieldValue(key as DailyReportTemplateFieldKey, input);
    if (value !== null && value !== undefined && value !== "") {
      coverSheet.getCell(address).value = value;
    }
  }

  const workerColumns = parseWorkerColumns(version.workerColumnsJson);
  input.workers.forEach((worker, index) => {
    const row = version.workerStartRow + index;
    if (workerColumns.workerName) workerSheet.getCell(`${workerColumns.workerName}${row}`).value = worker.workerName;
    if (workerColumns.role) workerSheet.getCell(`${workerColumns.role}${row}`).value = worker.role ?? "";
    if (workerColumns.startTime) workerSheet.getCell(`${workerColumns.startTime}${row}`).value = worker.startTime ?? "";
    if (workerColumns.endTime) workerSheet.getCell(`${workerColumns.endTime}${row}`).value = worker.endTime ?? "";
    if (workerColumns.workDescription)
      workerSheet.getCell(`${workerColumns.workDescription}${row}`).value = worker.workDescription ?? "";
    if (workerColumns.manDays) workerSheet.getCell(`${workerColumns.manDays}${row}`).value = worker.manDays ?? "";
  });

  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
