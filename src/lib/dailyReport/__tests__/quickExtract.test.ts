import { describe, expect, it } from "vitest";
import { extractQuickEntriesByRules, type ExtractMasters } from "../quickExtract";
import { STANDARD_HAZARDS, STANDARD_MACHINES, STANDARD_WORK_ITEMS } from "../standardMasters";
import { mergeExtraction, totalHeadcount, type QuickState } from "../quickInput";

const masters: ExtractMasters = {
  works: STANDARD_WORK_ITEMS.map((w, i) => ({ id: `w${i}`, label: w.label })),
  machines: STANDARD_MACHINES.map((name, i) => ({ id: `m${i}`, name })),
  hazards: STANDARD_HAZARDS.map((h, i) => ({ id: `h${i}`, label: h.label, measures: h.measures })),
};

const EXAMPLE =
  "今日は坂戸市役所で汚水管を20m布設。作業員3名。0.25バックホウ1台と4tダンプ1台使用。危険箇所は重機との接触。";

describe("音声からの自動抽出(ルール)", () => {
  it("依頼書の例文から、作業内容・数量・機械・人数・危険を取り出せる", () => {
    const result = extractQuickEntriesByRules(EXAMPLE, masters);

    expect(result.works).toEqual([{ workItemId: "w13", label: "汚水管布設", quantity: 20, unit: "m" }]);
    expect(result.machines).toEqual([
      { machineId: "m1", name: "バックホー0.25㎥", quantity: 1 },
      { machineId: "m4", name: "4tダンプ", quantity: 1 },
    ]);
    expect(result.workerCount).toBe(3);
    expect(result.hazards.map((h) => h.label)).toEqual(["重機との接触"]);
    expect(result.unclear).toEqual([]);
  });

  it("翌日の予定を取り出せる", () => {
    const result = extractQuickEntriesByRules("汚水管を布設しました。明日は桝設置を行います。", masters);
    expect(result.nextDayPlan).toBe("桝設置を行います");
  });

  it("バックホーの大きさが分からないときは機械を入れず、確認を促す", () => {
    const result = extractQuickEntriesByRules("バックホウで掘削した。", masters);
    expect(result.machines).toEqual([]);
    expect(result.unclear.join()).toContain("バックホーの大きさ");
    expect(result.works.map((w) => w.label)).toEqual(["掘削工"]);
  });

  it("ダンプの大きさが分からないときも確認を促す", () => {
    const result = extractQuickEntriesByRules("ダンプで残土を搬出", masters);
    expect(result.machines).toEqual([]);
    expect(result.unclear.join()).toContain("ダンプの大きさ");
    expect(result.works.map((w) => w.label)).toEqual(["残土運搬"]);
  });

  it("機械の大きさ(0.25m3)を、作業の数量と取り違えない", () => {
    const result = extractQuickEntriesByRules("掘削は0.25m3のバックホウ2台で実施。", masters);
    expect(result.works[0]).toMatchObject({ label: "掘削工", quantity: null });
    expect(result.machines).toEqual([{ machineId: "m1", name: "バックホー0.25㎥", quantity: 2 }]);
  });

  it("トン・メートル・平米・立米などの言い方に対応する", () => {
    const result = extractQuickEntriesByRules("4トンダンプ2台で砕石を搬入、転圧は100平米。路盤を15メートル施工。", masters);
    expect(result.machines).toEqual([{ machineId: "m4", name: "4tダンプ", quantity: 2 }]);
    const labels = result.works.map((w) => w.label);
    expect(labels).toEqual(expect.arrayContaining(["砕石敷均し", "転圧工", "路盤工"]));
    expect(result.works.find((w) => w.label === "転圧工")).toMatchObject({ quantity: null }); // 同じ文に作業が複数
  });

  it("人工は人数に数えず、人工の合計として取り出す", () => {
    const result = extractQuickEntriesByRules("職長1名、作業員3名で合計4人工。", masters);
    expect(result.workerCount).toBe(4);
    expect(result.manDaysTotal).toBe(4);
  });

  it("標準のマスタにない機械は、名前だけで入れて単価未登録として知らせる", () => {
    const result = extractQuickEntriesByRules("0.7バックホウ1台を使用。", masters);
    expect(result.machines).toEqual([{ machineId: null, name: "バックホー0.7㎥", quantity: 1 }]);
    expect(result.unclear.join()).toContain("機械マスタにありません");
  });

  it("会社が足した独自の作業内容・危険も、名前そのままで見つける", () => {
    const custom: ExtractMasters = {
      ...masters,
      works: [...masters.works, { id: "wx", label: "法面保護" }],
      hazards: [...masters.hazards, { id: "hx", label: "ハチの巣", measures: [] }],
    };
    const result = extractQuickEntriesByRules("法面保護を実施。ハチの巣に注意。", custom);
    expect(result.works.map((w) => w.label)).toContain("法面保護");
    expect(result.hazards.map((h) => h.label)).toContain("ハチの巣");
  });

  it("関係のない文章からは何も取り出さない(推測で埋めない)", () => {
    const result = extractQuickEntriesByRules("こんにちは。", masters);
    expect(result).toMatchObject({ works: [], machines: [], workerCount: null, hazards: [], nextDayPlan: null });
  });
});

describe("音声の抽出結果とタップ入力の統合", () => {
  it("タップで選んだ内容と音声の内容を重ねても、同じ機械・作業は二重にならない", () => {
    let n = 0;
    const makeKey = () => `k${++n}`;
    const extraction = extractQuickEntriesByRules(EXAMPLE, masters);

    const tapped: QuickState = {
      works: [{ key: "t1", workItemId: "w13", label: "汚水管布設", quantity: null, unit: "m", workMinutes: 120, remarks: null }],
      machines: [{ key: "t2", id: null, machineId: "m1", name: "バックホー0.25㎥", ownership: "RENTAL", quantity: 1, usageValue: 1 }],
      labor: [],
      ky: [],
    };
    const merged = mergeExtraction(tapped, extraction, makeKey);

    expect(merged.state.works).toHaveLength(1);
    expect(merged.state.works[0]).toMatchObject({ quantity: 20, workMinutes: 120 }); // 空欄の数量だけ音声で補う
    expect(merged.state.machines.map((m) => m.name)).toEqual(["バックホー0.25㎥", "4tダンプ"]);
    expect(merged.state.machines[0].ownership).toBe("RENTAL"); // タップで選んだ内容を壊さない
    expect(totalHeadcount(merged.state.labor)).toBe(3);

    // もう一度同じ音声を重ねても、何も増えない
    const again = mergeExtraction(merged.state, extraction, makeKey);
    expect(again.state.works).toHaveLength(1);
    expect(again.state.machines).toHaveLength(2);
    expect(totalHeadcount(again.state.labor)).toBe(3);
    expect(again.added).toEqual([]);
  });
});
