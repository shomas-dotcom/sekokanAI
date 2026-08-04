type Item = { quantity: number; unitPrice: number };

export function computeQuoteTotals(
  items: Item[],
  taxRatePercent: number,
  discountAmount: number
) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const tax = Math.round(afterDiscount * (taxRatePercent / 100));
  const total = afterDiscount + tax;
  return { subtotal, discountAmount, afterDiscount, tax, total };
}
