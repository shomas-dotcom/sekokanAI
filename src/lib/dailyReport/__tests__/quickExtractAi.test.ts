import { describe, expect, it } from "vitest";
import { mergeAiHints } from "../quickExtractAi";
import { extractQuickEntriesByRules, type ExtractMasters } from "../quickExtract";
import { STANDARD_HAZARDS, STANDARD_MACHINES, STANDARD_WORK_ITEMS } from "../standardMasters";

const masters: ExtractMasters = {
  works: STANDARD_WORK_ITEMS.map((w, i) => ({ id: `w${i}`, label: w.label })),
  machines: STANDARD_MACHINES.map((name, i) => ({ id: `m${i}`, name })),
  hazards: STANDARD_HAZARDS.map((h, i) => ({ id: `h${i}`, label: h.label, measures: h.measures })),
};

const noHints = { works: [], machines: [], workerCount: null, manDaysTotal: null, hazards: [], nextDayPlan: null };

describe("AIが選んだ名前の確認(mergeAiHints)", () => {
  it("一覧にある名前だけを取り入れ、一覧にない名前は確定せず確認にまわす", () => {
    const rules = extractQuickEntriesByRules("こんにちは。", masters);
    const merged = mergeAiHints(
      rules,
      {
        ...noHints,
        works: [
          { name: "掘削工", quantity: 12, unit: "㎥" },
          { name: "魔法の作業", quantity: 1, unit: "m" },
        ],
        machines: [
          { name: "バックホー0.25㎥", quantity: 2 },
          { name: "ロケット", quantity: 1 },
        ],
        hazards: ["重機との接触", "宇宙人の襲撃"],
      },
      masters
    );
    expect(merged.works).toEqual([{ workItemId: "w0", label: "掘削工", quantity: 12, unit: "㎥" }]);
    expect(merged.machines).toEqual([{ machineId: "m1", name: "バックホー0.25㎥", quantity: 2 }]);
    expect(merged.hazards.map((h) => h.label)).toEqual(["重機との接触"]);
    expect(merged.unclear).toHaveLength(3);
    expect(merged.unclear.join()).toContain("魔法の作業");
  });

  it("ルールですでに取れているものは増やさない。数量が空欄なら補う", () => {
    const rules = extractQuickEntriesByRules("掘削は0.25バックホウ1台で。", masters);
    expect(rules.works[0].quantity).toBeNull();
    const merged = mergeAiHints(
      rules,
      { ...noHints, works: [{ name: "掘削工", quantity: 30, unit: "㎥" }], machines: [{ name: "バックホー0.25㎥", quantity: 1 }] },
      masters
    );
    expect(merged.works).toHaveLength(1);
    expect(merged.works[0]).toMatchObject({ quantity: 30, unit: "㎥" });
    expect(merged.machines).toHaveLength(1);
  });

  it("単位が決められた中にない数量は取り入れない・極端な人数や台数も取り入れない", () => {
    const rules = extractQuickEntriesByRules("こんにちは。", masters);
    const merged = mergeAiHints(
      rules,
      {
        ...noHints,
        works: [{ name: "清掃", quantity: 5, unit: "リットル" }],
        machines: [{ name: "プレート", quantity: 9999 }],
        workerCount: 5000,
      },
      masters
    );
    expect(merged.works[0]).toMatchObject({ label: "清掃", quantity: null, unit: null });
    expect(merged.machines[0].quantity).toBe(1);
    expect(merged.workerCount).toBeNull();
  });
});
