// 会社ごとの見積雛形で、表紙シートに書き込める項目の一覧。
// キーを増やすときはここに追加するだけでよい(マッピング画面・出力の両方が自動で対応する)。
export const QUOTE_TEMPLATE_FIELD_KEYS = [
  "COMPANY_NAME",
  "COMPANY_POSTAL_CODE",
  "COMPANY_ADDRESS",
  "COMPANY_PHONE",
  "COMPANY_REPRESENTATIVE_NAME",
  "CUSTOMER_NAME",
  "ESTIMATE_NUMBER",
  "ISSUE_DATE",
  "PROJECT_NAME",
  "SITE_ADDRESS",
  "PERIOD",
  "EXPIRATION_DATE",
  "PAYMENT_TERMS",
  "NOTES",
  "SUBTOTAL",
  "DISCOUNT",
  "TAX",
  "TOTAL",
] as const;

export type QuoteTemplateFieldKey = (typeof QUOTE_TEMPLATE_FIELD_KEYS)[number];

export const QUOTE_TEMPLATE_FIELD_LABEL: Record<QuoteTemplateFieldKey, string> = {
  COMPANY_NAME: "自社名",
  COMPANY_POSTAL_CODE: "自社郵便番号",
  COMPANY_ADDRESS: "自社住所",
  COMPANY_PHONE: "自社電話番号",
  COMPANY_REPRESENTATIVE_NAME: "自社代表者名",
  CUSTOMER_NAME: "顧客名(御中の前)",
  ESTIMATE_NUMBER: "見積番号",
  ISSUE_DATE: "発行日",
  PROJECT_NAME: "件名",
  SITE_ADDRESS: "工事場所",
  PERIOD: "工期",
  EXPIRATION_DATE: "見積有効期限",
  PAYMENT_TERMS: "支払条件",
  NOTES: "備考",
  SUBTOTAL: "税抜金額(小計)",
  DISCOUNT: "値引き額",
  TAX: "消費税",
  TOTAL: "御見積金額(合計)",
};

export function isQuoteTemplateFieldKey(value: string): value is QuoteTemplateFieldKey {
  return (QUOTE_TEMPLATE_FIELD_KEYS as readonly string[]).includes(value);
}

// 明細の列に割り当てられる項目。amountは省略可(テンプレート側に数量×単価の数式が
// すでにある場合は書き込まず、そのまま計算させる)。
export const QUOTE_TEMPLATE_ITEM_COLUMN_KEYS = [
  "itemName",
  "spec",
  "quantity",
  "unit",
  "unitPrice",
  "amount",
  "remarks",
] as const;

export type QuoteTemplateItemColumnKey = (typeof QUOTE_TEMPLATE_ITEM_COLUMN_KEYS)[number];

export const QUOTE_TEMPLATE_ITEM_COLUMN_LABEL: Record<QuoteTemplateItemColumnKey, string> = {
  itemName: "工事項目名",
  spec: "規格・形状寸法",
  quantity: "数量",
  unit: "単位",
  unitPrice: "単価",
  amount: "金額(数量×単価。テンプレートに数式がある場合は割り当てない)",
  remarks: "備考",
};

export type QuoteTemplateFieldMapping = Partial<Record<QuoteTemplateFieldKey, string>>;
export type QuoteTemplateItemColumns = Partial<Record<QuoteTemplateItemColumnKey, string>>;

const CELL_ADDRESS_RE = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/;
const COLUMN_LETTER_RE = /^[A-Z]{1,3}$/;

export function isValidCellAddress(value: string): boolean {
  return CELL_ADDRESS_RE.test(value.trim().toUpperCase());
}

export function isValidColumnLetter(value: string): boolean {
  return COLUMN_LETTER_RE.test(value.trim().toUpperCase());
}

/** 保存されたJSONを安全に読む。壊れている場合は空扱いにする(出力時に例外で落ちないようにする)。 */
export function parseFieldMapping(json: string): QuoteTemplateFieldMapping {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: QuoteTemplateFieldMapping = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isQuoteTemplateFieldKey(key) && typeof value === "string" && isValidCellAddress(value)) {
        result[key] = value.trim().toUpperCase();
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function parseItemColumns(json: string): QuoteTemplateItemColumns {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: QuoteTemplateItemColumns = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        (QUOTE_TEMPLATE_ITEM_COLUMN_KEYS as readonly string[]).includes(key) &&
        typeof value === "string" &&
        isValidColumnLetter(value)
      ) {
        result[key as QuoteTemplateItemColumnKey] = value.trim().toUpperCase();
      }
    }
    return result;
  } catch {
    return {};
  }
}
