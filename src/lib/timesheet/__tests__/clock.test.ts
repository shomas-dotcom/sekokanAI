import { describe, expect, it } from "vitest";
import { jstTargetDate, resolveBreakMinutes } from "@/lib/timesheet/clock";
import { formatHm, parseMonthParam } from "@/lib/timesheet/monthlySheet";

describe("jstTargetDate", () => {
  it("日本時間の日付を、日報と同じ形(その日のUTC 0時)で返す", () => {
    expect(jstTargetDate(new Date("2026-10-26T23:30:00Z")).toISOString()).toBe("2026-10-27T00:00:00.000Z"); // JST 10/27 8:30
    expect(jstTargetDate(new Date("2026-10-26T14:59:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z"); // JST 10/26 23:59
  });
});

describe("resolveBreakMinutes", () => {
  it("勤怠にすでに休憩が入っていればそれを使う", () => {
    expect(resolveBreakMinutes(600, 60, 120)).toBe(60);
  });
  it("6時間を超える勤務は会社設定の休憩を引く", () => {
    expect(resolveBreakMinutes(541, 0, 120)).toBe(120);
  });
  it("6時間以下の短い勤務からは休憩を引かない", () => {
    expect(resolveBreakMinutes(360, 0, 120)).toBe(0);
  });
});

describe("parseMonthParam", () => {
  it("YYYY-MMを読む", () => {
    expect(parseMonthParam("2026-09")).toEqual({ year: 2026, month: 9 });
  });
  it("不正・未指定なら日本時間の今月", () => {
    const now = new Date("2026-10-31T16:00:00Z"); // JST 11/1 1:00
    expect(parseMonthParam(undefined, now)).toEqual({ year: 2026, month: 11 });
    expect(parseMonthParam("2026-13", now)).toEqual({ year: 2026, month: 11 });
  });
});

describe("formatHm", () => {
  it("分をh:mmにする(0や空は空欄)", () => {
    expect(formatHm(510)).toBe("8:30");
    expect(formatHm(65)).toBe("1:05");
    expect(formatHm(0)).toBe("");
    expect(formatHm(null)).toBe("");
  });
});
