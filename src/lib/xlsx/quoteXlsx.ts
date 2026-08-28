import ExcelJS from "exceljs";

/**
 * 実物の「見積書ひな形.xlsx」(表紙シート)の体裁を踏襲したExcel見積書。
 *
 * 元ファイルとの違い(意図的な簡略化。理由を明記):
 * 1. 元ファイルは印刷時の版下合わせのため列幅3.13の列を42列並べる特殊な作り(セル結合を
 *    ドラッグで自由に調整するための設計)になっていたが、本コードは列B〜Hの通常の
 *    表組みで同じ見た目(タイトル・金額box・件名欄・明細・会社印影欄)を再現する。
 * 2. 元ファイルの明細シートは「工種」「種別」の2階層+原価列(印刷範囲外の隠し列)を
 *    持っていたが、本システムのQuoteItemは1階層(工事項目)のみで原価も別欄に持つため、
 *    原価列はこの出力には含めない(原価はお客様に見せる書類ではなく社内編集画面のみに表示する)。
 */

const FONT = { name: "游ゴシック", size: 10.5 } as const;
const TITLE_FONT = { name: "游ゴシック", size: 20, bold: true } as const;
const HEADER_FONT = { name: "游ゴシック", size: 10.5, bold: true } as const;
const AMOUNT_FONT = { name: "游ゴシック", size: 16, bold: true } as const;
const THIN = { style: "thin" as const };
const BOX = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const CENTER = { horizontal: "center" as const, vertical: "middle" as const };
const RIGHT = { horizontal: "right" as const, vertical: "middle" as const };
const LEFT_ALIGN = { horizontal: "left" as const, vertical: "middle" as const, wrapText: true };

export type QuoteXlsxItem = {
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type QuoteXlsxInput = {
  companyName: string;
  companyPostalCode: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyRepresentativeName: string | null;
  customerName: string;
  estimateNumber: string | null;
  issueDateText: string; // 例: "2026年08月28日"
  projectName: string;
  siteAddress: string | null;
  paymentTerms: string | null;
  expirationDateText: string | null;
  periodText: string | null; // 工期
  items: QuoteXlsxItem[];
  subtotal: number;
  discountAmount: number;
  taxRatePercent: number;
  tax: number;
  total: number;
  notes: string | null;
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
  cell.alignment = opts.align ?? LEFT_ALIGN;
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

export async function buildQuoteXlsx(input: QuoteXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("見積書", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
    views: [{ showGridLines: false }],
  });

  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 8;
  ws.getColumn(7).width = 13;
  ws.getColumn(8).width = 16;

  ws.getRow(1).height = 34;

  // --- タイトル ---
  mergedCell(ws, "B1:H1", "御　見　積　書", { font: TITLE_FONT, align: CENTER, border: false });

  // --- 宛先・発行日 ---
  mergedCell(ws, "B3:E3", `${input.customerName}　御中`, {
    font: { ...FONT, size: 13 },
    align: LEFT_ALIGN,
    border: false,
  });
  mergedCell(ws, "F3:H3", input.estimateNumber ? `見積番号：${input.estimateNumber}` : "", {
    align: RIGHT,
    border: false,
  });
  mergedCell(ws, "F4:H4", `見積作成日：${input.issueDateText}`, { align: RIGHT, border: false });

  // --- 御見積金額(box) ---
  mergedCell(ws, "B6:D7", "御見積金額", { font: HEADER_FONT, align: CENTER });
  mergedCell(ws, "E6:H7", `${input.total.toLocaleString("ja-JP")}円（税込）`, {
    font: AMOUNT_FONT,
    align: RIGHT,
  });
  mergedCell(ws, "B8:D8", "内消費税", { align: CENTER });
  mergedCell(ws, "E8:H8", `${input.tax.toLocaleString("ja-JP")}円`, { align: RIGHT });

  // --- 件名・現場・支払条件等 ---
  const metaRows: [string, string][] = [
    ["件名", input.projectName],
    ...(input.siteAddress ? ([["工事場所", input.siteAddress]] as [string, string][]) : []),
    ["支払条件", input.paymentTerms ?? "別途お打合せ"],
    ["見積有効期限", input.expirationDateText ?? "発行日より30日"],
    ...(input.periodText ? ([["工期", input.periodText]] as [string, string][]) : []),
  ];
  let row = 10;
  for (const [label, value] of metaRows) {
    mergedCell(ws, `B${row}:C${row}`, label, { font: HEADER_FONT, align: CENTER });
    mergedCell(ws, `D${row}:H${row}`, value, { align: LEFT_ALIGN });
    row++;
  }
  row++; // 空行

  // --- 明細表(B:工事項目 C:規格 D:数量 E:単位 F:単価 G:H結合:金額) ---
  const tableHeaderRow = row;
  ["B", "C", "D", "E", "F"].forEach((col, i) => {
    setCell(ws, `${col}${tableHeaderRow}`, ["工事項目", "規格", "数量", "単位", "単価"][i], {
      font: HEADER_FONT,
      align: CENTER,
    });
  });
  mergedCell(ws, `G${tableHeaderRow}:H${tableHeaderRow}`, "金額", { font: HEADER_FONT, align: CENTER });

  row = tableHeaderRow + 1;
  for (const item of input.items) {
    setCell(ws, `B${row}`, item.itemName, { align: LEFT_ALIGN });
    setCell(ws, `C${row}`, item.spec ?? "", { align: LEFT_ALIGN });
    setCell(ws, `D${row}`, item.quantity, { align: RIGHT });
    setCell(ws, `E${row}`, item.unit, { align: CENTER });
    setCell(ws, `F${row}`, item.unitPrice, { align: RIGHT });
    mergedCell(ws, `G${row}:H${row}`, item.quantity * item.unitPrice, { align: RIGHT });
    row++;
  }

  // --- 合計 ---
  mergedCell(ws, `B${row}:F${row}`, "小計", { align: RIGHT, border: false, font: HEADER_FONT });
  mergedCell(ws, `G${row}:H${row}`, input.subtotal, { align: RIGHT });
  row++;
  if (input.discountAmount > 0) {
    mergedCell(ws, `B${row}:F${row}`, "値引き", { align: RIGHT, border: false, font: HEADER_FONT });
    mergedCell(ws, `G${row}:H${row}`, -input.discountAmount, { align: RIGHT });
    row++;
  }
  mergedCell(ws, `B${row}:F${row}`, `消費税(${input.taxRatePercent}%)`, {
    align: RIGHT,
    border: false,
    font: HEADER_FONT,
  });
  mergedCell(ws, `G${row}:H${row}`, input.tax, { align: RIGHT });
  row++;
  mergedCell(ws, `B${row}:F${row}`, "合計(税込)", { align: RIGHT, border: false, font: HEADER_FONT });
  mergedCell(ws, `G${row}:H${row}`, input.total, { align: RIGHT, font: { ...FONT, bold: true } });
  row += 2;

  // --- 備考 ---
  if (input.notes) {
    mergedCell(ws, `B${row}:C${row}`, "備考", { font: HEADER_FONT, align: CENTER });
    mergedCell(ws, `D${row}:H${row}`, input.notes, { align: LEFT_ALIGN });
    row += 2;
  } else {
    row += 1;
  }

  // --- 発行会社(印影欄) ---
  mergedCell(ws, `E${row}:H${row}`, input.companyName, {
    align: RIGHT,
    border: false,
    font: { ...FONT, size: 13, bold: true },
  });
  row++;
  if (input.companyRepresentativeName) {
    mergedCell(ws, `E${row}:H${row}`, `代表取締役　${input.companyRepresentativeName}　㊞`, {
      align: RIGHT,
      border: false,
    });
    row++;
  }
  const addressLine = [input.companyPostalCode ? `〒${input.companyPostalCode}` : null, input.companyAddress]
    .filter(Boolean)
    .join("　");
  if (addressLine) {
    mergedCell(ws, `E${row}:H${row}`, addressLine, { align: RIGHT, border: false });
    row++;
  }
  if (input.companyPhone) {
    mergedCell(ws, `E${row}:H${row}`, `TEL　${input.companyPhone}`, { align: RIGHT, border: false });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
