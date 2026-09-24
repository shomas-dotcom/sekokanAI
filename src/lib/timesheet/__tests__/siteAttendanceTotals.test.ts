import { describe, expect, it } from "vitest";
import { parseUnitPrice, sumRows } from "@/lib/timesheet/siteAttendanceTotals";

const row = (over: Partial<Parameters<typeof sumRows>[0][number]> = {}) => ({
  manDays: 1,
  isBillable: true,
  isCostTarget: true,
  manDayUnitPrice: 35_000,
  laborCostUnitPrice: 30_000,
  ...over,
});

describe("sumRows(出面の原価・請求・粗利)", () => {
  it("原価と請求を別々の単価で計算し、粗利を出す", () => {
    const t = sumRows([row(), row({ manDays: 0.5 })]);
    expect(t.laborCost).toBe(45_000);
    expect(t.billing).toBe(52_500);
    expect(t.grossProfit).toBe(7_500);
  });

  it("同じ単価を原価と請求に使い回さない(以前は粗利が常に0になっていた)", () => {
    const t = sumRows([row({ laborCostUnitPrice: null })]);
    expect(t.laborCost).toBe(0);
    expect(t.billing).toBe(35_000);
  });

  it("原価単価が未入力の行は0円で足さず件数で示し、粗利は出さない", () => {
    const t = sumRows([row(), row({ laborCostUnitPrice: null })]);
    expect(t.laborCost).toBe(30_000);
    expect(t.laborCostMissing).toBe(1);
    expect(t.grossProfit).toBeNull();
  });

  it("請求単価が未入力の請求対象行も件数で示し、粗利は出さない", () => {
    const t = sumRows([row({ manDayUnitPrice: null })]);
    expect(t.billingMissing).toBe(1);
    expect(t.grossProfit).toBeNull();
  });

  it("請求対象外の行は請求に数えず、未入力にも数えない", () => {
    const t = sumRows([row({ isBillable: false, manDayUnitPrice: null })]);
    expect(t.billing).toBe(0);
    expect(t.billingMissing).toBe(0);
    expect(t.grossProfit).toBe(-30_000);
  });

  it("原価対象外の行は原価に数えない", () => {
    const t = sumRows([row({ isCostTarget: false, laborCostUnitPrice: null })]);
    expect(t.laborCost).toBe(0);
    expect(t.laborCostMissing).toBe(0);
  });

  it("行がなければ粗利は出さない", () => {
    expect(sumRows([]).grossProfit).toBeNull();
  });
});

describe("parseUnitPrice", () => {
  it("空欄は未入力(null)", () => expect(parseUnitPrice("  ")).toBeNull());
  it("カンマ付きも読める", () => expect(parseUnitPrice("30,000")).toBe(30_000));
  it("マイナス・小数・文字は不正", () => {
    expect(parseUnitPrice("-1")).toBeUndefined();
    expect(parseUnitPrice("1.5")).toBeUndefined();
    expect(parseUnitPrice("abc")).toBeUndefined();
  });
});
