import { describe, expect, it } from "vitest";
import { buildDefaultClauses, mergeClausesWithPast, type ContractClause } from "@/lib/contractClauses";

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

describe("mergeClausesWithPast", () => {
  const freshClauses: ContractClause[] = [
    { key: "kouji_naiyou", title: "第1条(工事内容)", text: "新しい工事内容" },
    { key: "kingaku", title: "第2条(契約金額)", text: "新しい金額" },
    { key: "koki", title: "第3条(工期)", text: "新しい工期" },
    { key: "shiharai", title: "第4条(支払方法)", text: "新しい支払条件" },
    { key: "kaijo", title: "第14条(契約の解除)", text: "デフォルトの解除条項" },
    { key: "tokuyaku", title: "第18条(特約事項)", text: "特記事項がある場合はここに記載する。" },
  ];

  it("過去契約が無ければfreshClausesをそのまま返す", () => {
    expect(mergeClausesWithPast(freshClauses, null)).toEqual(freshClauses);
  });

  it("工事内容・金額・工期・支払条件は必ず新しい内容のままにする", () => {
    const pastClauses: ContractClause[] = [
      { key: "kouji_naiyou", title: "第1条(工事内容)", text: "古い工事内容" },
      { key: "kingaku", title: "第2条(契約金額)", text: "古い金額" },
      { key: "koki", title: "第3条(工期)", text: "古い工期" },
      { key: "shiharai", title: "第4条(支払方法)", text: "古い支払条件" },
    ];
    const merged = mergeClausesWithPast(freshClauses, pastClauses);
    const byKey = Object.fromEntries(merged.map((c) => [c.key, c.text]));
    expect(byKey.kouji_naiyou).toBe("新しい工事内容");
    expect(byKey.kingaku).toBe("新しい金額");
    expect(byKey.koki).toBe("新しい工期");
    expect(byKey.shiharai).toBe("新しい支払条件");
  });

  it("それ以外の条項は過去契約で編集された文面を引き継ぐ", () => {
    const pastClauses: ContractClause[] = [
      { key: "kaijo", title: "第14条(契約の解除)", text: "この顧客専用にカスタマイズした解除条項" },
      { key: "tokuyaku", title: "第18条(特約事項)", text: "駐車場は現場近隣のコインパーキングを利用する。" },
    ];
    const merged = mergeClausesWithPast(freshClauses, pastClauses);
    const byKey = Object.fromEntries(merged.map((c) => [c.key, c.text]));
    expect(byKey.kaijo).toBe("この顧客専用にカスタマイズした解除条項");
    expect(byKey.tokuyaku).toBe("駐車場は現場近隣のコインパーキングを利用する。");
  });

  it("過去契約にキーが存在しない条項はfreshClausesのまま残す", () => {
    const merged = mergeClausesWithPast(freshClauses, []);
    const byKey = Object.fromEntries(merged.map((c) => [c.key, c.text]));
    expect(byKey.kaijo).toBe("デフォルトの解除条項");
  });
});
