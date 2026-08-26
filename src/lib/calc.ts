export type RoundingModeValue = "FLOOR" | "ROUND" | "CEIL";

/** 消費税額等の端数処理(REQUIREMENTS.md #16)。切り捨て/四捨五入/切り上げから選択できる。 */
export function applyRounding(value: number, mode: RoundingModeValue): number {
  switch (mode) {
    case "FLOOR":
      return Math.floor(value);
    case "CEIL":
      return Math.ceil(value);
    default:
      return Math.round(value);
  }
}

/** 税抜金額から消費税額・税込金額を計算する(契約書用)。 */
export function computeContractAmounts(
  contractAmountExcludingTax: number,
  taxRatePercent: number,
  roundingMode: RoundingModeValue = "ROUND"
) {
  const taxAmount = applyRounding(
    contractAmountExcludingTax * (taxRatePercent / 100),
    roundingMode
  );
  return {
    taxAmount,
    contractAmountIncludingTax: contractAmountExcludingTax + taxAmount,
  };
}

type Item = { quantity: number; unitPrice: number };

/** 明細行から小計・消費税・合計を計算する(請求書用)。日本円は整数で扱い、浮動小数点誤差を避ける。 */
export function computeInvoiceItemsTotal(
  items: Item[],
  taxRatePercent: number,
  roundingMode: RoundingModeValue = "ROUND"
) {
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  );
  const tax = applyRounding(subtotal * (taxRatePercent / 100), roundingMode);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export type BillingProgressInput = {
  contractAmountIncludingTax: number;
  previousBilledAmount: number;
  currentBilledAmount: number;
};

export type BillingProgressResult = {
  previousBilledAmount: number;
  currentBilledAmount: number;
  cumulativeBilledAmount: number;
  remainingAmount: number;
  exceedsContractAmount: boolean;
};

/**
 * 出来高/分割請求の整合性を計算する。累計請求額(cumulativeBilledAmount)が
 * 契約金額(税込)を超える場合はexceedsContractAmount=trueを返す。
 * 呼び出し側はこの場合、保存・発行を必ず拒否すること(REQUIREMENTS.md #10)。
 */
export function computeBillingProgress(input: BillingProgressInput): BillingProgressResult {
  const cumulativeBilledAmount = input.previousBilledAmount + input.currentBilledAmount;
  const remainingAmount = input.contractAmountIncludingTax - cumulativeBilledAmount;
  return {
    previousBilledAmount: input.previousBilledAmount,
    currentBilledAmount: input.currentBilledAmount,
    cumulativeBilledAmount,
    remainingAmount,
    exceedsContractAmount: cumulativeBilledAmount > input.contractAmountIncludingTax,
  };
}
