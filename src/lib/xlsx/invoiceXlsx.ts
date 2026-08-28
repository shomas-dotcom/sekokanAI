import ExcelJS from "exceljs";

/**
 * 実際に使っている「まるた株式会社向け請求書.xlsx」の体裁を踏襲したExcel請求書。
 * (「日本道路請求書 - ひな形.xlsx」は特定取引先専用の入力補助マクロ付きシートで
 * 汎用化に向かないため、汎用的に使っているこちらの実物を基準にした)
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

export type InvoiceXlsxItem = {
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type InvoiceXlsxInput = {
  companyName: string;
  companyPostalCode: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyInvoiceRegistrationNumber: string | null;
  companyBankName: string | null;
  companyBankBranch: string | null;
  companyBankAccountType: string | null;
  companyBankAccountNumber: string | null;
  companyBankAccountHolder: string | null;
  // 電子印鑑(角印・代表印などのPNG/JPEG画像)。用意できたら自社情報の脇に自動で
  // 貼り込む。未設定の場合は印を押すための空欄(枠)だけを用意する。
  companySealImage?: { buffer: Buffer; extension: "png" | "jpeg" };
  customerName: string;
  customerAddress: string | null;
  invoiceNumber: string;
  issueDateText: string;
  dueDateText: string | null;
  projectName: string;
  items: InvoiceXlsxItem[];
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
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

export async function buildInvoiceXlsx(input: InvoiceXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("請求書", {
    pageSetup: {
      paperSize: 9,
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
  ws.getColumn(9).width = 11; // 電子印鑑欄

  ws.getRow(1).height = 34;
  for (let r = 3; r <= 6; r++) ws.getRow(r).height = 15; // 印鑑欄が概ね正方形(21mm角)になるよう高さを揃える

  // --- タイトル ---
  mergedCell(ws, "B1:H1", "請　求　書", { font: TITLE_FONT, align: CENTER, border: false });

  // --- 宛先・自社情報 ---
  mergedCell(ws, "B3:D3", `${input.customerName}　御中`, {
    font: { ...FONT, size: 13 },
    align: LEFT_ALIGN,
    border: false,
  });
  mergedCell(ws, "F3:H3", input.companyName, {
    font: { ...FONT, size: 13, bold: true },
    align: RIGHT,
    border: false,
  });
  if (input.customerAddress) {
    mergedCell(ws, "B4:D4", input.customerAddress, { align: LEFT_ALIGN, border: false });
  }
  const companyAddressLine = [
    input.companyPostalCode ? `〒${input.companyPostalCode}` : null,
    input.companyAddress,
  ]
    .filter(Boolean)
    .join("　");
  if (companyAddressLine) {
    mergedCell(ws, "F4:H4", companyAddressLine, { align: RIGHT, border: false });
  }
  if (input.companyPhone) {
    mergedCell(ws, "F5:H5", `TEL: ${input.companyPhone}`, { align: RIGHT, border: false });
  }
  if (input.companyInvoiceRegistrationNumber) {
    mergedCell(ws, "F6:H6", `登録番号：${input.companyInvoiceRegistrationNumber}`, {
      align: RIGHT,
      border: false,
    });
  }

  // --- 電子印鑑欄(自社情報の脇、I3:I6を21mm角のスペースとして確保) ---
  mergedCell(ws, "I3:I6", input.companySealImage ? null : "印", {
    align: CENTER,
    font: { ...FONT, size: 9, color: { argb: "FFAAAAAA" } },
    border: true,
  });
  if (input.companySealImage) {
    const imageId = wb.addImage({
      buffer: input.companySealImage.buffer as unknown as ExcelJS.Buffer,
      extension: input.companySealImage.extension,
    });
    // I3:I6のセル範囲いっぱいに配置する(枠は上で描画済みなので画像は枠内に重ねる想定)
    ws.addImage(imageId, "I3:I6");
  }

  // --- 請求書番号・日付 ---
  mergedCell(ws, "B8:C8", "請求書番号：", { font: HEADER_FONT, align: RIGHT, border: false });
  mergedCell(ws, "D8:E8", input.invoiceNumber, { align: LEFT_ALIGN, border: false });
  mergedCell(ws, "B9:C9", "請求日：", { font: HEADER_FONT, align: RIGHT, border: false });
  mergedCell(ws, "D9:E9", input.issueDateText, { align: LEFT_ALIGN, border: false });
  if (input.dueDateText) {
    mergedCell(ws, "B10:C10", "お支払期限：", { font: HEADER_FONT, align: RIGHT, border: false });
    mergedCell(ws, "D10:E10", input.dueDateText, { align: LEFT_ALIGN, border: false });
  }

  // --- 件名 ---
  mergedCell(ws, "B12:H12", `件名：${input.projectName}`, { align: LEFT_ALIGN, border: false });

  // --- ご請求金額(box) ---
  mergedCell(ws, "B14:D15", "ご請求金額（税込）", { font: HEADER_FONT, align: CENTER });
  mergedCell(ws, "E14:H15", `${input.total.toLocaleString("ja-JP")}円`, {
    font: AMOUNT_FONT,
    align: RIGHT,
  });

  // --- 明細表 ---
  let row = 18;
  const tableHeaderRow = row;
  ["No.", "工事内容", "規格", "数量", "単位", "単価"].forEach((label, i) => {
    const col = ["B", "C", "D", "E", "F", "G"][i];
    setCell(ws, `${col}${tableHeaderRow}`, label, { font: HEADER_FONT, align: CENTER });
  });
  setCell(ws, `H${tableHeaderRow}`, "金額", { font: HEADER_FONT, align: CENTER });

  row = tableHeaderRow + 1;
  input.items.forEach((item, i) => {
    setCell(ws, `B${row}`, i + 1, { align: CENTER });
    setCell(ws, `C${row}`, item.itemName, { align: LEFT_ALIGN });
    setCell(ws, `D${row}`, item.spec ?? "", { align: LEFT_ALIGN });
    setCell(ws, `E${row}`, item.quantity, { align: RIGHT });
    setCell(ws, `F${row}`, item.unit, { align: CENTER });
    setCell(ws, `G${row}`, item.unitPrice, { align: RIGHT });
    setCell(ws, `H${row}`, item.quantity * item.unitPrice, { align: RIGHT });
    row++;
  });

  // --- 合計 ---
  mergedCell(ws, `B${row}:F${row}`, "小計（税抜）", { align: RIGHT, border: false, font: HEADER_FONT });
  setCell(ws, `G${row}`, "", { border: false });
  setCell(ws, `H${row}`, input.subtotal, { align: RIGHT });
  row++;
  mergedCell(ws, `B${row}:F${row}`, `消費税（${input.taxRatePercent}%）`, {
    align: RIGHT,
    border: false,
    font: HEADER_FONT,
  });
  setCell(ws, `G${row}`, "", { border: false });
  setCell(ws, `H${row}`, input.taxAmount, { align: RIGHT });
  row++;
  mergedCell(ws, `B${row}:F${row}`, "合計（税込）", { align: RIGHT, border: false, font: HEADER_FONT });
  setCell(ws, `G${row}`, "", { border: false });
  setCell(ws, `H${row}`, input.total, { align: RIGHT, font: { ...FONT, bold: true } });
  row += 2;

  // --- 振込先 ---
  if (input.companyBankName) {
    mergedCell(ws, `B${row}:H${row}`, "振込先", { font: HEADER_FONT, align: LEFT_ALIGN, border: false });
    row++;
    const bankLine = [
      input.companyBankName,
      input.companyBankBranch,
      input.companyBankAccountType,
      input.companyBankAccountNumber,
    ]
      .filter(Boolean)
      .join("　");
    mergedCell(ws, `B${row}:H${row}`, bankLine, { align: LEFT_ALIGN, border: false });
    row++;
    if (input.companyBankAccountHolder) {
      mergedCell(ws, `B${row}:H${row}`, input.companyBankAccountHolder, {
        align: LEFT_ALIGN,
        border: false,
      });
      row++;
    }
    row++;
  }

  // --- 備考 ---
  if (input.notes) {
    mergedCell(ws, `B${row}:H${row}`, "備考", { font: HEADER_FONT, align: LEFT_ALIGN, border: false });
    row++;
    mergedCell(ws, `B${row}:H${row + 1}`, input.notes, { align: LEFT_ALIGN, border: false });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
