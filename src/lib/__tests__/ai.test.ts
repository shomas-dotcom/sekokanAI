import { describe, expect, it } from "vitest";
import { draftDailyReportFromText } from "@/lib/ai";

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
