import { describe, expect, it } from "vitest";
import { computeQuoteProfitability, computeQuoteTotals } from "./totals";

describe("computeQuoteTotals", () => {
  it("小計・値引き後・消費税・合計を計算する", () => {
    const totals = computeQuoteTotals(
      [{ quantity: 2, unitPrice: 1000 }, { quantity: 1, unitPrice: 500 }],
      10,
      200
    );
    expect(totals.subtotal).toBe(2500);
    expect(totals.afterDiscount).toBe(2300);
    expect(totals.tax).toBe(230);
    expect(totals.total).toBe(2530);
  });
});

describe("computeQuoteProfitability", () => {
  it("原価区分ごとに集計し、粗利益・粗利率を計算する", () => {
    const result = computeQuoteProfitability([
      { quantity: 10, unitPrice: 1000, costPrice: 600, costCategory: "MACHINERY" },
      { quantity: 5, unitPrice: 2000, costPrice: 1200, costCategory: "LABOR" },
    ]);
    // 売価: 10*1000 + 5*2000 = 20000
    // 原価: 10*600(重機費) + 5*1200(労務費) = 6000 + 6000 = 12000
    expect(result.sellSubtotal).toBe(20000);
    expect(result.costByBucket.MACHINERY).toBe(6000);
    expect(result.costByBucket.LABOR).toBe(6000);
    expect(result.totalCost).toBe(12000);
    expect(result.grossProfit).toBe(8000);
    expect(result.grossProfitRate).toBeCloseTo(0.4);
  });

  it("原価未入力の明細は0円として扱う(原価不明を勝手に見積らない)", () => {
    const result = computeQuoteProfitability([
      { quantity: 1, unitPrice: 10000, costPrice: null, costCategory: null },
    ]);
    expect(result.totalCost).toBe(0);
    expect(result.grossProfit).toBe(10000);
    expect(result.grossProfitRate).toBe(1);
  });

  it("原価区分が未分類の場合はその他原価に計上する", () => {
    const result = computeQuoteProfitability([
      { quantity: 1, unitPrice: 1000, costPrice: 300, costCategory: null },
    ]);
    expect(result.costByBucket.OTHER).toBe(300);
  });

  it("売価が0の場合、粗利率はnullを返す(0除算を避ける)", () => {
    const result = computeQuoteProfitability([]);
    expect(result.grossProfitRate).toBeNull();
  });
});
