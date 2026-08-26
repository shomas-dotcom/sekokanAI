import ExcelJS from "exceljs";

/**
 * 既存Excel日報「日報ひな形.xlsx」(原価集計表)の忠実な再現。
 *
 * 元ファイルを解析した結果、列幅・行高・罫線・フォント・印刷設定は本コードの値の通り。
 * ただし以下は元ファイルのまま再現していない(理由をコメントに明記):
 *
 * 1. 累計金額(元ファイルではJ2セルが別ファイル`作業日報(杉本用).xlsx`への外部参照
 *    `[1]R60828!J2`になっていた)。本システムでは同一案件の日報を全てDBで管理して
 *    いるため、外部ファイルへのライブリンクは作らず、同一Projectの過去日報の
 *    小計金額を合計した値をこのセルへ静的に書き込む。仕組みは変わるが用途は同じ。
 * 2. 氏名・単価・職種等の結合セル(B:D, E:F, I:J等)は、元ファイルでは値が入っている
 *    行にのみ手動でセル結合されており(空欄行は結合されていない)、これは日々の
 *    手作業編集による表記ゆれであって意図された設計ではないと判断し、本コードでは
 *    全13行に一律で結合を適用する(元の意図した表構造をそのまま再現するため)。
 * 3. 自社持込材料/その他経費側の合計セル(H35/H45)には、元ファイルでは「計」表記が
 *    なかったが、視認性のため本コードでは追加している。
 */

const FONT = { name: "游ゴシック", size: 11 } as const;
const TITLE_FONT = { name: "游ゴシック", size: 18 } as const;
const THIN = { style: "thin" as const };
const BOX = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const };
const RIGHT = { horizontal: "right" as const, vertical: "middle" as const };
const LEFT_ALIGN = { horizontal: "left" as const, vertical: "middle" as const };

export type CostLedgerLaborEntry = {
  workerName: string;
  unitPrice: number | null;
  overtimeHours: number | null;
  jobType: string | null;
};

export type CostLedgerItem = {
  name: string;
  quantity: string | null;
  amount: number | null; // 金額 または 単価(呼び出し側の文脈による)
};

export type CostLedgerInput = {
  reportDateText: string; // 例: "令和7年3月31日"
  creatorName: string | null;
  projectName: string;
  cumulativeAmountBeforeToday: number; // 前日までの累計金額(同一案件のDB集計値)
  laborEntries: CostLedgerLaborEntry[];
  vehicles: CostLedgerItem[]; // 自社持込車両・機械(amount=金額)
  ownMaterials: CostLedgerItem[]; // 自社持込材料(amount=金額)
  partnerEquipment: CostLedgerItem[]; // 協力会社持込資機材(amount=単価)
  otherExpenses: CostLedgerItem[]; // その他経費(amount=単価)
  workContent: string | null;
};

function setCell(
  ws: ExcelJS.Worksheet,
  address: string,
  value: ExcelJS.CellValue,
  opts: { align?: Partial<ExcelJS.Alignment>; font?: Partial<ExcelJS.Font>; border?: boolean } = {}
) {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.font = opts.font ?? FONT;
  cell.alignment = opts.align ?? CENTER;
  if (opts.border !== false) cell.border = BOX;
  return cell;
}

function mergedCell(
  ws: ExcelJS.Worksheet,
  range: string,
  value: ExcelJS.CellValue,
  opts: { align?: Partial<ExcelJS.Alignment>; font?: Partial<ExcelJS.Font>; border?: boolean } = {}
) {
  ws.mergeCells(range);
  const topLeft = range.split(":")[0];
  return setCell(ws, topLeft, value, opts);
}

export async function buildCostLedgerXlsx(input: CostLedgerInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("日報", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 91,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
    properties: { defaultRowHeight: 18.75 },
    views: [{ showGridLines: true }],
  });

  // 列幅(元ファイル解析結果通り。B/C/Dは既定幅のまま)
  ws.getColumn(1).width = 4.375; // A
  ws.getColumn(5).width = 2.875; // E
  ws.getColumn(6).width = 9.875; // F
  ws.getColumn(7).width = 1.25; // G(区切り)
  ws.getColumn(8).width = 13.75; // H
  ws.getColumn(9).width = 10.75; // I
  ws.getColumn(10).width = 13.375; // J

  // 行高(元ファイル解析結果通り)
  const rowHeights: Record<number, number> = {
    1: 27.75,
    2: 27.75,
    3: 27.75,
    4: 9,
    5: 19.5,
    19: 19.5,
    20: 9.75,
    21: 19.5,
    36: 7.5,
    37: 19.5,
    46: 7.5,
    49: 19.5,
  };
  for (let r = 6; r <= 18; r++) rowHeights[r] = 15.95;
  for (let r = 22; r <= 35; r++) rowHeights[r] = 15.95;
  for (let r = 38; r <= 45; r++) rowHeights[r] = 15.95;
  for (const [r, h] of Object.entries(rowHeights)) ws.getRow(Number(r)).height = h;
  ws.getRow(48).height = 60; // 作業内容欄は元ファイルより高くし、実データの折返し表示に対応する

  // --- タイトル・小計/累計金額 ---
  mergedCell(ws, "D1:H1", "作　業　日　報", { font: TITLE_FONT, border: false });
  setCell(ws, "I1", "小計金額", { align: CENTER });
  const subtotalFormula = { formula: "E19+E35+J35+E45+J45" };
  setCell(ws, "J1", subtotalFormula, { align: RIGHT });
  setCell(ws, "I2", "累計金額", { align: CENTER });
  // 元ファイルは別ファイルへの外部参照だったが、本システムでは同一案件の過去日報
  // 合計(DB集計値)+当日小計を静的な数式として書き込む(上記コメント参照)。
  setCell(ws, "J2", { formula: `${input.cumulativeAmountBeforeToday}+J1` }, { align: RIGHT });

  mergedCell(ws, "A3:D3", `作業日　${input.reportDateText}`, { align: CENTER, border: true });
  setCell(ws, "F3", `作成者名　${input.creatorName ?? ""}`, { align: CENTER });
  setCell(ws, "I3", `現　場　名　${input.projectName}`, { align: CENTER });

  // --- 氏名・単価・残業・職種 ---
  mergedCell(ws, "B5:D5", "氏　　　名", { align: CENTER });
  mergedCell(ws, "E5:F5", "単　価", { align: CENTER });
  setCell(ws, "H5", "残　業", { align: CENTER });
  mergedCell(ws, "I5:J5", "職　　種", { align: CENTER });

  const LABOR_ROWS = 13;
  for (let i = 0; i < LABOR_ROWS; i++) {
    const r = 6 + i;
    const entry = input.laborEntries[i];
    setCell(ws, `A${r}`, i + 1, { align: CENTER });
    mergedCell(ws, `B${r}:D${r}`, entry?.workerName ?? null, { align: CENTER });
    mergedCell(ws, `E${r}:F${r}`, entry?.unitPrice ?? null, { align: RIGHT });
    setCell(ws, `H${r}`, entry?.overtimeHours ? `${entry.overtimeHours}h` : "h", { align: RIGHT });
    mergedCell(ws, `I${r}:J${r}`, entry?.jobType ?? null, { align: CENTER });
  }
  setCell(ws, "A19", "計", { align: CENTER });
  mergedCell(ws, "B19:D19", null, { align: CENTER });
  mergedCell(ws, "E19:F19", { formula: "SUM(E6:F18)" }, { align: RIGHT });
  mergedCell(ws, "I19:J19", null, { align: CENTER });

  // --- 自社持込車両・機械 / 自社持込材料 ---
  mergedCell(ws, "A21:C21", "自社持込車両・機械", { align: CENTER });
  setCell(ws, "D21", "数　量", { align: CENTER });
  mergedCell(ws, "E21:F21", "金　額", { align: CENTER });
  setCell(ws, "H21", "自社持込材料", { align: CENTER });
  setCell(ws, "I21", "数　量", { align: CENTER });
  setCell(ws, "J21", "金　額", { align: { ...CENTER, wrapText: true } });

  const OWN_ITEM_ROWS = 13;
  for (let i = 0; i < OWN_ITEM_ROWS; i++) {
    const r = 22 + i;
    const vehicle = input.vehicles[i];
    const material = input.ownMaterials[i];
    mergedCell(ws, `A${r}:C${r}`, vehicle?.name ?? null, { align: LEFT_ALIGN });
    setCell(ws, `D${r}`, vehicle?.quantity ?? null, { align: CENTER });
    mergedCell(ws, `E${r}:F${r}`, vehicle?.amount ?? null, { align: RIGHT });
    setCell(ws, `H${r}`, material?.name ?? null, { align: LEFT_ALIGN });
    setCell(ws, `I${r}`, material?.quantity ?? null, { align: CENTER });
    setCell(ws, `J${r}`, material?.amount ?? null, { align: RIGHT });
  }
  mergedCell(ws, "A35:C35", "計", { align: CENTER });
  mergedCell(ws, "E35:F35", { formula: "SUM(E22:F34)" }, { align: RIGHT });
  setCell(ws, "H35", "計", { align: CENTER });
  setCell(ws, "J35", { formula: "SUM(J22:J34)" }, { align: RIGHT });

  // --- 協力会社持込資機材 / その他経費 ---
  mergedCell(ws, "A37:C37", "協力会社持込資機材", { align: CENTER });
  setCell(ws, "D37", "数　量", { align: CENTER });
  mergedCell(ws, "E37:F37", "単　価", { align: CENTER });
  setCell(ws, "H37", "その他経費", { align: CENTER });
  setCell(ws, "I37", "数　量", { align: CENTER });
  setCell(ws, "J37", "単　価", { align: { ...CENTER, wrapText: true } });

  const PARTNER_ROWS = 7;
  for (let i = 0; i < PARTNER_ROWS; i++) {
    const r = 38 + i;
    const equipment = input.partnerEquipment[i];
    const expense = input.otherExpenses[i];
    mergedCell(ws, `A${r}:C${r}`, equipment?.name ?? null, { align: LEFT_ALIGN });
    setCell(ws, `D${r}`, equipment?.quantity ?? null, { align: CENTER });
    mergedCell(ws, `E${r}:F${r}`, equipment?.amount ?? null, { align: RIGHT });
    setCell(ws, `H${r}`, expense?.name ?? null, { align: LEFT_ALIGN });
    setCell(ws, `I${r}`, expense?.quantity ?? null, { align: CENTER });
    setCell(ws, `J${r}`, expense?.amount ?? null, { align: RIGHT });
  }
  mergedCell(ws, "A45:C45", "計", { align: CENTER });
  mergedCell(ws, "E45:F45", { formula: "SUM(E38:F44)" }, { align: RIGHT });
  setCell(ws, "H45", "計", { align: CENTER });
  setCell(ws, "J45", { formula: "SUM(J38:J44)" }, { align: RIGHT });

  // --- 作業内容 ---
  mergedCell(ws, "A47:J47", "作業内容", { align: LEFT_ALIGN });
  mergedCell(ws, "A48:J48", input.workContent ?? "", {
    align: { ...LEFT_ALIGN, wrapText: true },
  });
  mergedCell(ws, "A49:J49", null, { align: LEFT_ALIGN });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
