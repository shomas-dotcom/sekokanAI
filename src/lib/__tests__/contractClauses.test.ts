import { describe, expect, it } from "vitest";
import { buildDefaultClauses } from "@/lib/contractClauses";

describe("buildDefaultClauses", () => {
  const input = {
    projectName: "〇〇市道路改良工事",
    siteAddress: "埼玉県〇〇市〇〇町",
    overview: "道路土工、側溝工、舗装工",
    contractAmountExcludingTax: 5_000_000,
    taxAmount: 500_000,
    contractAmountIncludingTax: 5_500_000,
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-12-20"),
    paymentTerms: "月末締め翌月末払い",
  };

  it("REQUIREMENTS.mdで定義された18条項をすべて生成する", () => {
    const clauses = buildDefaultClauses(input);
    expect(clauses).toHaveLength(18);
    const keys = clauses.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length); // キーの重複がない
  });

  it("工事内容・金額・工期・支払条件が本文に反映される", () => {
    const clauses = buildDefaultClauses(input);
    const byKey = Object.fromEntries(clauses.map((c) => [c.key, c.text]));
    expect(byKey.kouji_naiyou).toContain("〇〇市道路改良工事");
    expect(byKey.kingaku).toContain("5,500,000円");
    expect(byKey.koki).toContain("2026/9/1");
    expect(byKey.shiharai).toContain("月末締め翌月末払い");
  });

  it("支払条件が未入力の場合は要確認と明示する(推測で断定しない)", () => {
    const clauses = buildDefaultClauses({ ...input, paymentTerms: null });
    const shiharai = clauses.find((c) => c.key === "shiharai");
    expect(shiharai?.text).toContain("要確認");
  });
});
