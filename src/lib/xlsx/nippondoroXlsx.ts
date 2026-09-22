import ExcelJS from "exceljs";
import path from "path";

// 日本道路株式会社「工事日報」(共帳022-01)指定様式。
//
// この様式は結合セル265か所・法定チェック項目等の固定文面を大量に含むため、
// ゼロから組み立てるのではなく、実際に提供を受けたExcelファイルの空欄シートを
// テンプレートとして src/lib/xlsx/templates/nippondoro.xlsx に保存しておき、
// 可変項目のセルだけを書き換える方式にした(既存のcostLedgerXlsx.tsのように
// ゼロから罫線・結合を組み立てる方式より、様式の再現精度が高く安全なため)。
//
// 重要: このマッピング(どのセルに何を書き込むか)は提供ファイルの実データを
// 目視で解析して作成したが、実際にExcelで開いて元の紙面/PDFと見比べた確認は
// まだ行っていない。本番提出前に必ず一度、実際の出力を元書式と見比べて
// 確認すること(呼び出し元のREADME/報告にもその旨を明記する)。

const TEMPLATE_PATH = path.join(process.cwd(), "src/lib/xlsx/templates/nippondoro.xlsx");

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export type NippondoroWorkTypeRow = {
  workType: string;
  subItem: string | null;
  workArea: string | null;
  unit: string | null;
  dailyQuantity: number | null;
  cumulativeQuantity: number;
  dailyWorkerCount: number | null;
  cumulativeWorkerCount: number;
  externalProviderName: string | null;
  externalProviderQuantity: number | null;
  externalProviderUnitPrice: number | null;
};

export type NippondoroMaterialRow = {
  name: string;
  spec: string | null;
  unit: string | null;
  dailyQuantity: number | null;
  cumulativeQuantity: number;
  inspectionResult: string | null; // "合" | "否" | null
  supplierName: string | null;
  remarks: string | null;
};

export type NippondoroMachineryRow = {
  machineType: string;
  spec: string | null;
  operatorName: string | null;
  dailyCount: number | null;
  cumulativeCount: number;
};

// 工種明細は9〜19行目(11行分)、使用材料は21〜30行目(10行分)、使用機械は
// D/F/H/J/L/N列の6枠(31〜35行目)に対応する(元ファイルの実データ範囲から特定)。
const WORK_TYPE_START_ROW = 9;
const WORK_TYPE_MAX_ROWS = 11;
const MATERIAL_START_ROW = 21;
const MATERIAL_MAX_ROWS = 10;
const MACHINERY_COLUMNS = ["D", "F", "H", "J", "L", "N"] as const;

export async function buildNippondoroXlsx(params: {
  siteAbbreviation: string | null;
  reportDate: Date;
  weather: string | null;
  startTime: string | null; // "HH:mm"
  endTime: string | null;
  workTypes: NippondoroWorkTypeRow[];
  materials: NippondoroMaterialRow[];
  machinery: NippondoroMachineryRow[];
}): Promise<Buffer<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.worksheets[0];

  const set = (address: string, value: unknown) => {
    ws.getCell(address).value = value as ExcelJS.CellValue;
  };

  // --- ヘッダー ---
  if (params.siteAbbreviation) set("P2", params.siteAbbreviation);
  set("A4", params.reportDate.getUTCMonth() + 1);
  set("C4", params.reportDate.getUTCDate());
  set("E4", WEEKDAY_JA[params.reportDate.getUTCDay()]);
  if (params.weather) set("H5", params.weather);
  const [startHour, startMinute] = (params.startTime ?? "").split(":");
  const [endHour, endMinute] = (params.endTime ?? "").split(":");
  if (startHour) set("K4", Number(startHour));
  if (startMinute) set("M4", Number(startMinute));
  if (endHour) set("K5", Number(endHour));
  if (endMinute) set("M5", Number(endMinute));
  // 工事統括者/工事管理者/所長・工事担当者の承認欄(O4〜U4)は、押印・署名欄のため
  // データを書き込まず空欄のままにする(既存の契約書等と同じく電子署名機能は未対応)。

  // --- 工種・出来高・作業人員・外部提供者 ---
  params.workTypes.slice(0, WORK_TYPE_MAX_ROWS).forEach((row, i) => {
    const r = WORK_TYPE_START_ROW + i;
    set(`A${r}`, row.workType);
    if (row.subItem) set(`D${r}`, row.subItem);
    if (row.workArea) set(`G${r}`, row.workArea);
    if (row.unit) set(`K${r}`, row.unit);
    if (row.dailyQuantity != null) set(`L${r}`, row.dailyQuantity);
    if (row.cumulativeQuantity) set(`N${r}`, row.cumulativeQuantity);
    if (row.dailyWorkerCount != null) set(`P${r}`, row.dailyWorkerCount);
    if (row.cumulativeWorkerCount) set(`Q${r}`, row.cumulativeWorkerCount);
    if (row.externalProviderName) set(`S${r}`, row.externalProviderName);
    if (row.externalProviderQuantity != null) set(`V${r}`, row.externalProviderQuantity);
    if (row.externalProviderUnitPrice != null) set(`X${r}`, row.externalProviderUnitPrice);
    // Y列(金額)はテンプレート側に数式(=V*X)が既に入っているため、そのまま活かす。
  });

  // --- 使用材料 ---
  params.materials.slice(0, MATERIAL_MAX_ROWS).forEach((row, i) => {
    const r = MATERIAL_START_ROW + i;
    set(`B${r}`, row.name);
    if (row.spec) set(`E${r}`, row.spec);
    if (row.unit) set(`I${r}`, row.unit);
    if (row.dailyQuantity != null) set(`J${r}`, row.dailyQuantity);
    if (row.cumulativeQuantity) set(`L${r}`, row.cumulativeQuantity);
    if (row.inspectionResult === "合") {
      set(`N${r}`, "合");
      set(`O${r}`, "");
    } else if (row.inspectionResult === "否") {
      set(`N${r}`, "");
      set(`O${r}`, "否");
    }
    if (row.supplierName) set(`P${r}`, row.supplierName);
    if (row.remarks) set(`S${r}`, row.remarks);
  });

  // --- 使用機械(列ごとに機種が固定、最大6枠) ---
  params.machinery.slice(0, MACHINERY_COLUMNS.length).forEach((row, i) => {
    const col = MACHINERY_COLUMNS[i];
    set(`${col}31`, row.machineType);
    if (row.spec) set(`${col}32`, row.spec);
    if (row.operatorName) set(`${col}33`, row.operatorName);
    if (row.dailyCount != null) set(`${col}34`, row.dailyCount);
    if (row.cumulativeCount) set(`${col}35`, row.cumulativeCount);
  });

  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
