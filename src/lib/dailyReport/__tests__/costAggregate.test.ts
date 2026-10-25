import { describe, expect, it } from "vitest";
import { aggregateCosts, jstDateKey, jstMonthKey, sumAll } from "../costAggregate";

describe("現場別の原価の集計", () => {
  it("労務費(人工×単価)と機械費を、現場ごとに足し合わせる", () => {
    const result = aggregateCosts(
      [
        { key: "A現場", manDays: 1, isCostTarget: true, laborCostUnitPrice: 30000 },
        { key: "A現場", manDays: 1.5, isCostTarget: true, laborCostUnitPrice: 24000 },
        { key: "B現場", manDays: 0.5, isCostTarget: true, laborCostUnitPrice: 30000 },
      ],
      [
        { key: "A現場", amount: 90000, isCostTarget: true },
        { key: "B現場", amount: 45000, isCostTarget: true },
      ]
    );
    expect(result.get("A現場")).toMatchObject({ manDays: 2.5, labor: 66000, machine: 90000, total: 156000 });
    expect(result.get("B現場")).toMatchObject({ manDays: 0.5, labor: 15000, machine: 45000, total: 60000 });
    expect(sumAll(result.values())).toMatchObject({ manDays: 3, labor: 81000, machine: 135000, total: 216000 });
  });

  it("単価が未登録の行は0円として足さず、件数で知らせる(人工数には数える)", () => {
    const result = aggregateCosts(
      [
        { key: "A", manDays: 1, isCostTarget: true, laborCostUnitPrice: null },
        { key: "A", manDays: 1, isCostTarget: true, laborCostUnitPrice: 30000 },
      ],
      [{ key: "A", amount: null, isCostTarget: true }]
    );
    expect(result.get("A")).toMatchObject({
      manDays: 2,
      labor: 30000,
      laborMissing: 1,
      machine: 0,
      machineMissing: 1,
      total: 30000,
    });
  });

  it("原価の対象でない行は、金額に入れない(人工数だけ数える)", () => {
    const result = aggregateCosts(
      [{ key: "A", manDays: 2, isCostTarget: false, laborCostUnitPrice: 30000 }],
      [{ key: "A", amount: 50000, isCostTarget: false }]
    );
    expect(result.get("A")).toMatchObject({ manDays: 2, labor: 0, laborMissing: 0, machine: 0, total: 0 });
  });

  it("日付・月のキーは日本時間の暦日で数える", () => {
    expect(jstDateKey(new Date("2026-10-01"))).toBe("2026-10-01");
    expect(jstDateKey(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10-01");
    expect(jstMonthKey(new Date("2026-10-31"))).toBe("2026-10");
  });
});
