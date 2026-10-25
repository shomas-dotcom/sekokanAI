import { describe, expect, it } from "vitest";
import {
  dedupeQuickState,
  hasOperatorDoubleCount,
  laborAmount,
  machineAmount,
  mergeExtraction,
  parseQuickPayload,
  summarizeKy,
  summarizeMachinery,
  summarizeQuantities,
  summarizeVehicles,
  summarizeWorks,
  totalHeadcount,
  totalManDays,
  type QuickExtraction,
  type QuickState,
} from "../quickInput";
import { manDaysFromHours, suggestHazardsFor, suggestMachinesForWorks } from "../standardMasters";

let n = 0;
const makeKey = () => `k${++n}`;

const emptyExtraction: QuickExtraction = {
  works: [],
  machines: [],
  workerCount: null,
  manDaysTotal: null,
  hazards: [],
  nextDayPlan: null,
  unclear: [],
};

function state(partial: Partial<QuickState> = {}): QuickState {
  return { works: [], machines: [], labor: [], ky: [], ...partial };
}

describe("入力内容の検査(parseQuickPayload)", () => {
  it("正しい内容は読み取れる", () => {
    const result = parseQuickPayload(
      JSON.stringify({
        works: [{ key: "a", label: "掘削工", quantity: 12.5, unit: "㎥", workMinutes: 180 }],
        machines: [{ key: "b", name: "バックホー0.25㎥", ownership: "RENTAL", quantity: 1, usageValue: 1 }],
        labor: [{ key: "c", category: "SUBCONTRACT_WORKER", headcount: 3, manDays: 0.5 }],
        ky: [{ key: "d", label: "重機との接触", measures: ["合図者配置", "合図者配置", "周囲確認"] }],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.works[0]).toMatchObject({ label: "掘削工", quantity: 12.5, unit: "㎥", workMinutes: 180 });
    expect(result.state.machines[0].ownership).toBe("RENTAL");
    expect(result.state.labor[0]).toMatchObject({ headcount: 3, manDays: 0.5, category: "SUBCONTRACT_WORKER" });
    // 同じ対策は1件にまとまる
    expect(result.state.ky[0].measures).toEqual(["合図者配置", "周囲確認"]);
  });

  it("壊れたJSONは日本語のエラーになる", () => {
    const result = parseQuickPayload("{broken");
    expect(result).toMatchObject({ ok: false });
  });

  it("マイナスや極端な数字・不正な区分は受け付けない", () => {
    expect(parseQuickPayload(JSON.stringify({ works: [{ label: "掘削工", quantity: -1 }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ machines: [{ name: "x", quantity: 0 }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ machines: [{ name: "x", ownership: "BORROWED" }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ labor: [{ category: "BOSS", headcount: 1, manDays: 1 }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ labor: [{ headcount: 1.5, manDays: 1 }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ labor: [{ headcount: 1, manDays: 99 }] })).ok).toBe(false);
  });

  it("名前が空の作業・機械・危険は受け付けない", () => {
    expect(parseQuickPayload(JSON.stringify({ works: [{ label: "  " }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ machines: [{ name: "" }] })).ok).toBe(false);
    expect(parseQuickPayload(JSON.stringify({ ky: [{ label: "" }] })).ok).toBe(false);
  });

  it("従業員を選んだ行を2名以上にはできない", () => {
    const result = parseQuickPayload(JSON.stringify({ labor: [{ employeeId: "e1", headcount: 2, manDays: 1 }] }));
    expect(result.ok).toBe(false);
  });

  it("件数が多すぎる入力は受け付けない", () => {
    const works = Array.from({ length: 51 }, (_, i) => ({ label: `作業${i}` }));
    expect(parseQuickPayload(JSON.stringify({ works })).ok).toBe(false);
  });
});

describe("重複の防止", () => {
  it("同じ作業を2回選んでも1件になり、空欄は後のもので補われる", () => {
    const result = dedupeQuickState(
      state({
        works: [
          { key: "1", workItemId: null, label: "掘削工", quantity: null, unit: null, workMinutes: null, remarks: null },
          { key: "2", workItemId: "w1", label: "掘削工", quantity: 20, unit: "m", workMinutes: null, remarks: null },
        ],
      })
    );
    expect(result.works).toHaveLength(1);
    expect(result.works[0]).toMatchObject({ quantity: 20, unit: "m", workItemId: "w1" });
  });

  it("同じ機械は台数を足さず1件にまとめる(全角半角の違いも同じ扱い)", () => {
    const base = { id: null, machineId: null, ownership: "OWN" as const, usageValue: 1 };
    const result = dedupeQuickState(
      state({
        machines: [
          { ...base, key: "1", name: "4tダンプ", quantity: 1 },
          { ...base, key: "2", name: "4ｔダンプ", quantity: 1 },
        ],
      })
    );
    expect(result.machines).toHaveLength(1);
    expect(result.machines[0].quantity).toBe(1);
  });

  it("自社所有とレンタルは別の機械として残す", () => {
    const base = { id: null, machineId: null, usageValue: 1, quantity: 1, name: "プレート" };
    const result = dedupeQuickState(
      state({
        machines: [
          { ...base, key: "1", ownership: "OWN" },
          { ...base, key: "2", ownership: "RENTAL" },
        ],
      })
    );
    expect(result.machines).toHaveLength(2);
  });

  it("同じ従業員は1行にまとめる", () => {
    const base = { id: null, category: "OWN_EMPLOYEE" as const, workerName: "田中", affiliation: null, headcount: 1, manDays: 1, workMinutes: null };
    const result = dedupeQuickState(
      state({
        labor: [
          { ...base, key: "1", employeeId: "e1" },
          { ...base, key: "2", employeeId: "e1" },
        ],
      })
    );
    expect(result.labor).toHaveLength(1);
  });
});

describe("音声の内容をタップ入力へ重ねる(mergeExtraction)", () => {
  it("すでに選んである機械・作業は重ねても増えない", () => {
    const current = state({
      works: [{ key: "w", workItemId: "w1", label: "汚水管布設", quantity: null, unit: "m", workMinutes: null, remarks: null }],
      machines: [{ key: "m", id: null, machineId: "m1", name: "バックホー0.25㎥", ownership: "OWN", quantity: 1, usageValue: 1 }],
    });
    const result = mergeExtraction(
      current,
      {
        ...emptyExtraction,
        works: [{ workItemId: "w1", label: "汚水管布設", quantity: 20, unit: "m" }],
        machines: [
          { machineId: "m1", name: "バックホー0.25㎥", quantity: 1 },
          { machineId: "m2", name: "4tダンプ", quantity: 1 },
        ],
      },
      makeKey
    );
    expect(result.state.works).toHaveLength(1);
    // すでにある作業の数量が空欄だったので、音声の数量で補う
    expect(result.state.works[0].quantity).toBe(20);
    expect(result.state.machines.map((m) => m.name)).toEqual(["バックホー0.25㎥", "4tダンプ"]);
    expect(result.added).toContain("機械「4tダンプ」1台");
    expect(result.skipped).toContain("機械「バックホー0.25㎥」");
  });

  it("作業員の人数は、すでに入っている人数を超えた分だけ足す(二重に数えない)", () => {
    const named = (i: number) => ({
      key: `n${i}`,
      id: null,
      category: "OWN_EMPLOYEE" as const,
      employeeId: `e${i}`,
      workerName: `社員${i}`,
      affiliation: null,
      headcount: 1,
      manDays: 1,
      workMinutes: null,
    });
    const current = state({ labor: [named(1), named(2)] });

    const more = mergeExtraction(current, { ...emptyExtraction, workerCount: 3 }, makeKey);
    expect(totalHeadcount(more.state.labor)).toBe(3);
    expect(more.state.labor[2]).toMatchObject({ category: null, headcount: 1 });

    const same = mergeExtraction(current, { ...emptyExtraction, workerCount: 2 }, makeKey);
    expect(same.state.labor).toHaveLength(2);
    expect(same.skipped).toContain("作業員2名");
  });

  it("人工の合計が分かれば、1人あたりの人工数にして入れる", () => {
    const result = mergeExtraction(state(), { ...emptyExtraction, workerCount: 4, manDaysTotal: 2 }, makeKey);
    expect(result.state.labor[0]).toMatchObject({ headcount: 4, manDays: 0.5 });
  });

  it("危険は入れるが、対策は自動では選ばない", () => {
    const result = mergeExtraction(
      state(),
      { ...emptyExtraction, hazards: [{ hazardId: "h1", label: "重機との接触", measures: ["合図者配置"] }] },
      makeKey
    );
    expect(result.state.ky[0]).toMatchObject({ label: "重機との接触", hazardId: "h1", measures: [] });
  });
});

describe("金額の計算", () => {
  it("機械は 台数 × 使用日数 × 単価。単価が未登録なら金額を出さない", () => {
    expect(machineAmount(2, 1.5, 30000)).toBe(90000);
    expect(machineAmount(1, 1, null)).toBeNull();
  });

  it("労務費は 人数 × 1人あたりの人工 × 単価", () => {
    expect(laborAmount(3, 0.5, 30000)).toBe(45000);
    expect(laborAmount(1, 1, null)).toBeNull();
  });

  it("人数と人工数の合計", () => {
    const labor = [
      { headcount: 3, manDays: 1 },
      { headcount: 2, manDays: 0.5 },
    ] as Parameters<typeof totalManDays>[0];
    expect(totalHeadcount(labor)).toBe(5);
    expect(totalManDays(labor)).toBe(4);
  });

  it("運転手込みの機械に重機オペレーターの人工も入っていれば二重計上の注意を出す", () => {
    expect(hasOperatorDoubleCount([{ includesOperator: true }], [{ category: "OPERATOR" }])).toBe(true);
    expect(hasOperatorDoubleCount([{ includesOperator: false }], [{ category: "OPERATOR" }])).toBe(false);
    expect(hasOperatorDoubleCount([{ includesOperator: true }], [{ category: "SUBCONTRACT_WORKER" }])).toBe(false);
  });

  it("作業時間から人工数を出す(基準8時間なら4時間は0.5人工、基準時間を変えると変わる)", () => {
    expect(manDaysFromHours(8, 480)).toBe(1);
    expect(manDaysFromHours(4, 480)).toBe(0.5);
    expect(manDaysFromHours(2, 480)).toBe(0.25);
    expect(manDaysFromHours(4, 420)).toBe(0.5);
    expect(manDaysFromHours(7, 420)).toBe(1);
    expect(manDaysFromHours(0, 480)).toBeNull();
  });
});

describe("既存の文章欄に書き込む要約", () => {
  it("作業内容・数量・機械・車両・KYを文章にする", () => {
    const works = [
      { key: "1", workItemId: null, label: "汚水管布設", quantity: 20, unit: "m", workMinutes: 240, remarks: null },
      { key: "2", workItemId: null, label: "清掃", quantity: null, unit: null, workMinutes: null, remarks: "全体" },
    ];
    expect(summarizeWorks(works)).toBe("汚水管布設 20m(4時間)、清掃 全体");
    expect(summarizeQuantities(works)).toBe("汚水管布設 20m");

    const base = { id: null, machineId: null, usageValue: 1 };
    const machines = [
      { ...base, key: "a", name: "バックホー0.25㎥", ownership: "OWN" as const, quantity: 1 },
      { ...base, key: "b", name: "4tダンプ", ownership: "RENTAL" as const, quantity: 2 },
    ];
    expect(summarizeMachinery(machines)).toBe("バックホー0.25㎥ 1台");
    expect(summarizeVehicles(machines)).toBe("4tダンプ 2台(レンタル)");

    expect(
      summarizeKy([
        { key: "k", hazardId: null, label: "重機との接触", measures: ["合図者配置", "周囲確認"] },
        { key: "k2", hazardId: null, label: "熱中症", measures: [] },
      ])
    ).toBe("重機との接触(対策: 合図者配置、周囲確認)\n熱中症");
  });
});

describe("作業内容からのおすすめ", () => {
  it("汚水管布設を選ぶと、バックホーと水中ポンプ、重機・掘削・埋設物・酸欠の危険がおすすめされる", () => {
    const machines = suggestMachinesForWorks(["汚水管布設"]);
    expect(machines).toContain("バックホー0.25㎥");
    expect(machines).toContain("水中ポンプ");
    const hazards = suggestHazardsFor(["汚水管布設"], machines);
    expect(hazards).toEqual(
      expect.arrayContaining(["掘削箇所の崩壊", "重機との接触", "埋設物の損傷", "酸素欠乏", "重機旋回時の接触", "感電事故"])
    );
    // 作業内容に由来する危険が、機械由来より先に並ぶ
    expect(hazards.indexOf("掘削箇所の崩壊")).toBeLessThan(hazards.indexOf("感電事故"));
  });

  it("会社が独自に足した作業内容には、おすすめを出さない", () => {
    expect(suggestMachinesForWorks(["独自の作業"])).toEqual([]);
    expect(suggestHazardsFor(["独自の作業"], [])).toEqual([]);
  });

  it("複数選んでも重複しない", () => {
    const machines = suggestMachinesForWorks(["掘削工", "残土積込"]);
    expect(new Set(machines).size).toBe(machines.length);
  });
});
