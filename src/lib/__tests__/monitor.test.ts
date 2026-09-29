import { describe, expect, it } from "vitest";
import { addCalendarMonthsJst, canCreateQuotes, isMonitorPeriodActive, monitorFreeUntil } from "@/lib/monitor";

describe("addCalendarMonthsJst", () => {
  it("通常の月は同じ日・同じ時刻へ進む", () => {
    // 2026-10-01 00:00 JST = 2026-09-30T15:00:00Z
    const start = new Date("2026-09-30T15:00:00.000Z");
    const result = addCalendarMonthsJst(start, 6);
    // 2027-04-01 00:00 JST = 2027-03-31T15:00:00Z
    expect(result.toISOString()).toBe("2027-03-31T15:00:00.000Z");
  });

  it("月末は繰り上げず、その月の末日に丸める(1/31 + 1か月 → 2/28、平年)", () => {
    // 2026-01-31 10:00 JST = 2026-01-31T01:00:00Z
    const start = new Date("2026-01-31T01:00:00.000Z");
    const result = addCalendarMonthsJst(start, 1);
    // JSTで2026-02-28 10:00 = 2026-02-28T01:00:00Z(2026年は平年)
    expect(result.toISOString()).toBe("2026-02-28T01:00:00.000Z");
  });

  it("うるう年の2月29日まで丸められる", () => {
    // 2027-08-31 09:00 JST = 2027-08-31T00:00:00Z
    const start = new Date("2027-08-31T00:00:00.000Z");
    const result = addCalendarMonthsJst(start, 6);
    // JSTで2028-02-29 09:00(2028年はうるう年) = 2028-02-29T00:00:00Z
    expect(result.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("年をまたぐ場合も正しく計算する", () => {
    // 2026-10-15 12:00 JST = 2026-10-15T03:00:00Z
    const start = new Date("2026-10-15T03:00:00.000Z");
    const result = addCalendarMonthsJst(start, 6);
    // JSTで2027-04-15 12:00 = 2027-04-15T03:00:00Z
    expect(result.toISOString()).toBe("2027-04-15T03:00:00.000Z");
  });
});

describe("monitorFreeUntil / isMonitorPeriodActive", () => {
  it("モニターでない会社はnull・false", () => {
    const company = { isMonitor: false, monitorEnrolledAt: null, monitorFreeMonths: null };
    expect(monitorFreeUntil(company)).toBeNull();
    expect(isMonitorPeriodActive(company)).toBe(false);
  });

  it("無料期間中はtrue、終了後はfalse(境界: 終了日時ちょうどは期間外)", () => {
    const enrolledAt = new Date("2026-09-30T15:00:00.000Z"); // JST 2026-10-01 00:00
    const company = { isMonitor: true, monitorEnrolledAt: enrolledAt, monitorFreeMonths: 6 };
    const until = monitorFreeUntil(company)!;
    expect(until.toISOString()).toBe("2027-03-31T15:00:00.000Z");

    const justBefore = new Date(until.getTime() - 1);
    const justAfter = new Date(until.getTime() + 1);
    expect(isMonitorPeriodActive(company, justBefore)).toBe(true);
    expect(isMonitorPeriodActive(company, until)).toBe(false);
    expect(isMonitorPeriodActive(company, justAfter)).toBe(false);
  });

  it("monitorFreeMonths未設定(データ不整合)は6か月扱いにする", () => {
    const enrolledAt = new Date("2026-09-30T15:00:00.000Z");
    const company = { isMonitor: true, monitorEnrolledAt: enrolledAt, monitorFreeMonths: null };
    expect(isMonitorPeriodActive(company, new Date("2027-01-01T00:00:00.000Z"))).toBe(true);
  });
});

describe("canCreateQuotes", () => {
  const base = { plan: "FREE", isMonitor: false, monitorEnrolledAt: null, monitorFreeMonths: null };

  it("PREMIUM契約があれば常にtrue", () => {
    expect(canCreateQuotes({ ...base, plan: "PREMIUM" })).toBe(true);
  });

  it("モニター無料期間中はtrue(PREMIUM契約が無くても)", () => {
    const enrolledAt = new Date("2026-09-30T15:00:00.000Z");
    expect(canCreateQuotes({ ...base, isMonitor: true, monitorEnrolledAt: enrolledAt, monitorFreeMonths: 6 })).toBe(
      true
    );
  });

  it("モニター期間終了後・PREMIUM契約なしはfalse", () => {
    const enrolledAt = new Date("2020-01-01T00:00:00.000Z");
    expect(canCreateQuotes({ ...base, isMonitor: true, monitorEnrolledAt: enrolledAt, monitorFreeMonths: 6 })).toBe(
      false
    );
  });

  it("どちらも無ければfalse", () => {
    expect(canCreateQuotes(base)).toBe(false);
  });
});
