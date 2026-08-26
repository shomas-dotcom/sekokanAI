import { describe, expect, it } from "vitest";
import {
  applyRounding,
  computeBillingProgress,
  computeContractAmounts,
  computeInvoiceItemsTotal,
} from "@/lib/calc";

describe("applyRounding", () => {
  it("切り捨て/四捨五入/切り上げを正しく計算する", () => {
    expect(applyRounding(10.4, "FLOOR")).toBe(10);
    expect(applyRounding(10.6, "FLOOR")).toBe(10);
    expect(applyRounding(10.4, "ROUND")).toBe(10);
    expect(applyRounding(10.5, "ROUND")).toBe(11);
    expect(applyRounding(10.1, "CEIL")).toBe(11);
  });
});

describe("computeContractAmounts", () => {
  it("税抜金額から消費税額・税込金額を計算する", () => {
    const result = computeContractAmounts(2_000_000, 10);
    expect(result.taxAmount).toBe(200_000);
    expect(result.contractAmountIncludingTax).toBe(2_200_000);
  });

  it("端数処理方法を切り捨てに指定できる", () => {
    const result = computeContractAmounts(1001, 10, "FLOOR");
    // 1001 * 0.1 = 100.1 -> 切り捨てで100
    expect(result.taxAmount).toBe(100);
    expect(result.contractAmountIncludingTax).toBe(1101);
  });
});

describe("computeInvoiceItemsTotal", () => {
  it("明細から小計・消費税・合計を計算する(浮動小数点誤差を避ける)", () => {
    const items = [
      { quantity: 100, unitPrice: 1234 },
      { quantity: 0.1, unitPrice: 10 }, // 浮動小数点誤差が出やすいケース
    ];
    const result = computeInvoiceItemsTotal(items, 10);
    expect(result.subtotal).toBe(123401);
    expect(result.tax).toBe(12340);
    expect(result.total).toBe(135741);
  });

  it("数量ゼロの明細のみでも0円として計算できる", () => {
    const result = computeInvoiceItemsTotal([], 10);
    expect(result).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe("computeBillingProgress", () => {
  it("累計請求額が契約金額以内なら正しく残額を計算する", () => {
    const result = computeBillingProgress({
      contractAmountIncludingTax: 2_200_000,
      previousBilledAmount: 660_000,
      currentBilledAmount: 880_000,
    });
    expect(result.cumulativeBilledAmount).toBe(1_540_000);
    expect(result.remainingAmount).toBe(660_000);
    expect(result.exceedsContractAmount).toBe(false);
  });

  it("累計請求額が契約金額と完全に一致する場合は超過にならない", () => {
    const result = computeBillingProgress({
      contractAmountIncludingTax: 1_000_000,
      previousBilledAmount: 400_000,
      currentBilledAmount: 600_000,
    });
    expect(result.remainingAmount).toBe(0);
    expect(result.exceedsContractAmount).toBe(false);
  });

  it("累計請求額が契約金額を1円でも超えると超過と判定する", () => {
    const result = computeBillingProgress({
      contractAmountIncludingTax: 1_000_000,
      previousBilledAmount: 400_000,
      currentBilledAmount: 600_001,
    });
    expect(result.remainingAmount).toBe(-1);
    expect(result.exceedsContractAmount).toBe(true);
  });
});
