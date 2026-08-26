import type { RateCategory } from "@/generated/prisma/enums";
import { costBucketForCategory, COST_BUCKET_LABEL, type CostBucket } from "@/lib/rateMaster";

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

type ProfitItem = {
  quantity: number;
  unitPrice: number;
  costPrice: number | null;
  costCategory: RateCategory | null;
};

/**
 * 見積の粗利益を計算する。売価は税抜小計、原価は各明細のcostPrice×数量を
 * costCategoryごとに集計する(依頼元の計算式: 売価－材料費－労務費－重機費－外注費－処分費－その他原価＝粗利益)。
 * costPriceが未入力の明細は原価0として扱う(原価不明を勝手に見積らない)。
 */
export function computeQuoteProfitability(items: ProfitItem[]) {
  const sellSubtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const costByBucket: Record<CostBucket, number> = {
    MATERIAL: 0,
    LABOR: 0,
    MACHINERY: 0,
    SUBCONTRACT: 0,
    DISPOSAL: 0,
    OTHER: 0,
  };
  for (const item of items) {
    if (item.costPrice == null) continue;
    costByBucket[costBucketForCategory(item.costCategory)] += item.quantity * item.costPrice;
  }

  const totalCost = Object.values(costByBucket).reduce((sum, v) => sum + v, 0);
  const grossProfit = sellSubtotal - totalCost;
  const grossProfitRate = sellSubtotal > 0 ? grossProfit / sellSubtotal : null;

  return { sellSubtotal, costByBucket, totalCost, grossProfit, grossProfitRate };
}

export { COST_BUCKET_LABEL };
