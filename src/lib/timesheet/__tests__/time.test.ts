import { describe, expect, it } from "vitest";
import {
  jstWallTimeToUtc,
  formatJstTime,
  formatJstDateTime,
  computeWorkMinutes,
  computeNightShiftMinutes,
  computeAttendanceBreakdown,
} from "@/lib/timesheet/time";

describe("jstWallTimeToUtc / formatJstTime", () => {
  it("日本時間8:00は UTC前日23:00になる(往復して同じ表示に戻る)", () => {
    const day = new Date(Date.UTC(2026, 8, 19, 0, 0, 0)); // 2026-09-19(どの時刻でも日付部分だけ使う)
    const utc = jstWallTimeToUtc(day, "08:00");
    expect(utc).not.toBeNull();
    expect(utc!.getUTCHours()).toBe(23);
    expect(utc!.getUTCDate()).toBe(18);
    expect(formatJstTime(utc)).toBe("08:00");
  });

  it("17:30を正しく往復できる", () => {
    const day = new Date(Date.UTC(2026, 8, 19, 0, 0, 0));
    const utc = jstWallTimeToUtc(day, "17:30");
    expect(formatJstTime(utc)).toBe("17:30");
  });

  it("不正な形式はnullを返す", () => {
    const day = new Date(Date.UTC(2026, 8, 19, 0, 0, 0));
    expect(jstWallTimeToUtc(day, "abc")).toBeNull();
    expect(jstWallTimeToUtc(day, "25:99")).toBeNull();
  });

  it("空/未設定はformatで空文字を返す", () => {
    expect(formatJstTime(null)).toBe("");
    expect(formatJstDateTime(undefined)).toBe("");
  });
});

describe("computeWorkMinutes", () => {
  it("8:00〜17:00、休憩60分で実働480分", () => {
    expect(computeWorkMinutes("08:00", "17:00", 60)).toBe(480);
  });

  it("開始・終了のどちらかが未入力ならnull", () => {
    expect(computeWorkMinutes(null, "17:00", 60)).toBeNull();
    expect(computeWorkMinutes("08:00", null, 60)).toBeNull();
  });

  it("終了が開始より前(逆転)ならnull", () => {
    expect(computeWorkMinutes("17:00", "08:00", 0)).toBeNull();
  });

  it("不正な形式はnull", () => {
    expect(computeWorkMinutes("abc", "17:00", 0)).toBeNull();
  });
});

describe("computeNightShiftMinutes", () => {
  const day = new Date(Date.UTC(2026, 8, 19, 0, 0, 0));

  it("日中の勤務は深夜時間0", () => {
    const in_ = jstWallTimeToUtc(day, "08:00");
    const out = jstWallTimeToUtc(day, "17:00");
    expect(computeNightShiftMinutes(in_, out, "22:00", "05:00")).toBe(0);
  });

  it("22:00〜翌5:00の勤務は全て深夜時間(420分)", () => {
    const in_ = jstWallTimeToUtc(day, "22:00");
    const out = jstWallTimeToUtc(day, "05:00");
    expect(computeNightShiftMinutes(in_, out, "22:00", "05:00")).toBe(420);
  });

  it("20:00〜24:00は22:00〜24:00の120分だけ深夜時間", () => {
    const in_ = jstWallTimeToUtc(day, "20:00");
    const out = jstWallTimeToUtc(day, "00:00");
    expect(computeNightShiftMinutes(in_, out, "22:00", "05:00")).toBe(120);
  });

  it("出勤・退勤が未設定ならnull", () => {
    expect(computeNightShiftMinutes(null, null, "22:00", "05:00")).toBeNull();
  });
});

describe("computeAttendanceBreakdown", () => {
  it("実働480分・所定480分なら残業0", () => {
    const result = computeAttendanceBreakdown({
      actualWorkMinutes: 480,
      workCategory: "NORMAL",
      scheduledWorkMinutes: 480,
    });
    expect(result).toEqual({ normalWorkMinutes: 480, overtimeMinutes: 0, holidayWorkMinutes: 0 });
  });

  it("実働540分・所定480分なら残業60分", () => {
    const result = computeAttendanceBreakdown({
      actualWorkMinutes: 540,
      workCategory: "NORMAL",
      scheduledWorkMinutes: 480,
    });
    expect(result).toEqual({ normalWorkMinutes: 480, overtimeMinutes: 60, holidayWorkMinutes: 0 });
  });

  it("休日出勤は全て休日勤務時間になる", () => {
    const result = computeAttendanceBreakdown({
      actualWorkMinutes: 300,
      workCategory: "HOLIDAY_WORK",
      scheduledWorkMinutes: 480,
    });
    expect(result).toEqual({ normalWorkMinutes: 0, overtimeMinutes: 0, holidayWorkMinutes: 300 });
  });

  it("実働時間が未確定ならすべてnull", () => {
    const result = computeAttendanceBreakdown({
      actualWorkMinutes: null,
      workCategory: "NORMAL",
      scheduledWorkMinutes: 480,
    });
    expect(result).toEqual({ normalWorkMinutes: null, overtimeMinutes: null, holidayWorkMinutes: null });
  });
});
