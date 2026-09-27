import ExcelJS from "exceljs";
import type { QuoteXlsxInput } from "./quoteXlsx";
import {
  parseFieldMapping,
  parseItemColumns,
  type QuoteTemplateFieldKey,
} from "./quoteTemplateFields";

export type QuoteTemplateVersionInput = {
  fileData: Buffer;
  sheetName: string;
  fieldMappingJson: string;
  itemSheetName: string;
  itemStartRow: number;
  itemMaxRows: number;
  itemColumnsJson: string;
};

/** 登録した会社の雛形が対応できる明細件数を超えている場合に投げる(部分的な出力はしない)。 */
export class QuoteTemplateTooManyItemsError extends Error {
  constructor(
    public readonly itemCount: number,
    public readonly itemMaxRows: number
  ) {
    super(`明細が${itemCount}件あり、この雛形が対応できる${itemMaxRows}件を超えています。`);
    this.name = "QuoteTemplateTooManyItemsError";
  }
}

function fieldValue(key: QuoteTemplateFieldKey, input: QuoteXlsxInput): string | number | null {
  switch (key) {
    case "COMPANY_NAME":
      return input.companyName;
    case "COMPANY_POSTAL_CODE":
      return input.companyPostalCode;
    case "COMPANY_ADDRESS":
      return input.companyAddress;
    case "COMPANY_PHONE":
      return input.companyPhone;
    case "COMPANY_REPRESENTATIVE_NAME":
      return input.companyRepresentativeName;
    case "CUSTOMER_NAME":
      return input.customerName;
    case "ESTIMATE_NUMBER":
      return input.estimateNumber;
    case "ISSUE_DATE":
      return input.issueDateText;
    case "PROJECT_NAME":
      return input.projectName;
    case "SITE_ADDRESS":
      return input.siteAddress;
    case "PERIOD":
      return input.periodText;
    case "EXPIRATION_DATE":
      return input.expirationDateText;
    case "PAYMENT_TERMS":
      return input.paymentTerms;
    case "NOTES":
      return input.notes;
    case "SUBTOTAL":
      return input.subtotal;
    case "DISCOUNT":
      return input.discountAmount;
    case "TAX":
      return input.tax;
    case "TOTAL":
      return input.total;
    default:
      return null;
  }
}

/**
 * 会社が登録した雛形(元のExcelファイル)を読み込み、マッピングで指定したセルだけを
 * 書き込んで返す。それ以外の罫線・結合・書式・数式・固定文言はいっさい変更しない。
 */
export async function buildQuoteXlsxFromTemplate(
  version: QuoteTemplateVersionInput,
  input: QuoteXlsxInput
): Promise<Buffer<ArrayBuffer>> {
  if (input.items.length > version.itemMaxRows) {
    throw new QuoteTemplateTooManyItemsError(input.items.length, version.itemMaxRows);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(version.fileData as unknown as ExcelJS.Buffer);

  const coverSheet = wb.getWorksheet(version.sheetName);
  if (!coverSheet) throw new Error(`雛形にシート「${version.sheetName}」が見つかりません。`);
  const itemSheet = wb.getWorksheet(version.itemSheetName);
  if (!itemSheet) throw new Error(`雛形にシート「${version.itemSheetName}」が見つかりません。`);

  const fieldMapping = parseFieldMapping(version.fieldMappingJson);
  for (const [key, address] of Object.entries(fieldMapping)) {
    const value = fieldValue(key as QuoteTemplateFieldKey, input);
    if (value !== null && value !== undefined && value !== "") {
      coverSheet.getCell(address).value = value;
    }
  }

  const itemColumns = parseItemColumns(version.itemColumnsJson);
  input.items.forEach((item, index) => {
    const row = version.itemStartRow + index;
    if (itemColumns.itemName) itemSheet.getCell(`${itemColumns.itemName}${row}`).value = item.itemName;
    if (itemColumns.spec) itemSheet.getCell(`${itemColumns.spec}${row}`).value = item.spec ?? "";
    if (itemColumns.quantity) itemSheet.getCell(`${itemColumns.quantity}${row}`).value = item.quantity;
    if (itemColumns.unit) itemSheet.getCell(`${itemColumns.unit}${row}`).value = item.unit;
    if (itemColumns.unitPrice) itemSheet.getCell(`${itemColumns.unitPrice}${row}`).value = item.unitPrice;
    // amount列は多くの雛形で「数量×単価」の数式が入っているため、割り当てられている
    // ときだけ書く(数式を消して固定値にしてしまわないよう、既定では触らない)。
    if (itemColumns.amount) itemSheet.getCell(`${itemColumns.amount}${row}`).value = item.quantity * item.unitPrice;
    if (itemColumns.remarks) itemSheet.getCell(`${itemColumns.remarks}${row}`).value = item.remarks ?? "";
  });

  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
