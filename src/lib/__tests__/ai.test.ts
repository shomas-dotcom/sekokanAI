import { describe, expect, it } from "vitest";
import { draftDailyReportFromText, draftQuoteItemsFromText, draftKyItems } from "@/lib/ai";

describe("draftDailyReportFromText (モック実装)", () => {
  it("依頼文の音声入力例から各項目を抽出し、聞き取れなかった項目はunclearItemsに積む", async () => {
    const text =
      "今日は〇〇建設の現場。バックホウ0.25を使って砕石を25㎡敷均し。プレート転圧。職人3人。8時開始。17時終了。危険箇所は重機接触。翌日は型枠施工。";

    const draft = await draftDailyReportFromText(text);

    expect(draft.machinery).toContain("バックホウ");
    expect(draft.machinery).toContain("プレート");
    expect(draft.quantityWorked).toContain("25㎡");
    expect(draft.startTime).toBe("08:00");
    expect(draft.endTime).toBe("17:00");
    expect(draft.dangerPrediction).toContain("重機接触");
    expect(draft.nextDayPlan).toContain("型枠施工");

    // 職長・作業員数は本文からは特定できないため、断定せず確認候補として積まれる
    expect(draft.foremanName).toBeNull();
    expect(draft.unclearItems.some((i) => i.field === "職長")).toBe(true);
  });

  it("使用車両(ダンプ等)は使用機械とは別枠として抽出する", async () => {
    const draft = await draftDailyReportFromText("4トンダンプで残土搬出。0.25BH使用。");
    expect(draft.vehicles).toContain("ダンプ");
    expect(draft.machinery).toContain("0.25BH");
    expect(draft.machinery).not.toContain("ダンプ");
  });

  it("開始/終了時間・危険予知・翌日の予定が聞き取れなかった場合は確認候補として積む", async () => {
    const draft = await draftDailyReportFromText("作業内容はL型側溝据付20m。作業員4名。天候晴れ。異常なし。");
    expect(draft.startTime).toBeNull();
    expect(draft.endTime).toBeNull();
    expect(draft.dangerPrediction).toBeNull();
    expect(draft.nextDayPlan).toBeNull();
    const fields = draft.unclearItems.map((i) => i.field);
    expect(fields).toEqual(
      expect.arrayContaining(["職長", "開始時間", "終了時間", "危険予知", "翌日の予定"])
    );
  });
});

describe("draftQuoteItemsFromText (モック実装)", () => {
  const rateMaster = [
    {
      id: "rate-1",
      name: "L型側溝撤去新設",
      unit: "m",
      unitPrice: 8000,
      costPrice: 5000,
      category: "SUBCONTRACT",
    },
  ];

  it("単価マスタに一致する品目は会社単価を反映する(単価を勝手に作らない)", async () => {
    const items = await draftQuoteItemsFromText("L型側溝撤去新設33m", rateMaster);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(33);
    expect(items[0].unit).toBe("m");
    expect(items[0].unitPriceHint).toBe(8000);
    expect(items[0].costPriceHint).toBe(5000);
    expect(items[0].matchedRateItemId).toBe("rate-1");
  });

  it("単価マスタに一致しない品目は単価不明のまま(unitPriceHint=null)にする", async () => {
    const items = await draftQuoteItemsFromText("舗装撤去復旧20㎡", rateMaster);
    expect(items[0].quantity).toBe(20);
    expect(items[0].unit).toBe("m2");
    expect(items[0].unitPriceHint).toBeNull();
    expect(items[0].matchedRateItemId).toBeNull();
  });

  it("「3人4日」のような労務表記は人日に換算する", async () => {
    const items = await draftQuoteItemsFromText("土工3人4日", []);
    expect(items[0].quantity).toBe(12);
    expect(items[0].unit).toBe("人日");
  });

  it("改行・読点区切りで複数項目に分ける", async () => {
    const items = await draftQuoteItemsFromText("掘削工\n残土処分、L型側溝設置", []);
    expect(items.map((i) => i.itemName)).toEqual(["掘削工", "残土処分", "L型側溝設置"]);
  });
});

describe("draftKyItems (モック実装)", () => {
  it("作業内容のキーワードから危険ポイント・対策の候補を提案する", async () => {
    const items = await draftKyItems("バックホウで掘削し、ダンプで残土搬出する");
    const risks = items.map((i) => i.risk);
    expect(risks).toContain("重機との接触・巻き込まれ");
    expect(risks).toContain("土砂崩壊による埋没");
    expect(risks).toContain("後退時の接触・巻き込まれ");
    // 対策が伴わない危険ポイントを作らない(必ず対をなす)
    for (const item of items) {
      expect(item.countermeasure.length).toBeGreaterThan(0);
    }
  });

  it("一致するキーワードが無い場合は空の1行を返す(「異常なし」等を勝手に作らない)", async () => {
    const items = await draftKyItems("事務所で書類整理");
    expect(items).toEqual([{ risk: "", countermeasure: "" }]);
  });
});
