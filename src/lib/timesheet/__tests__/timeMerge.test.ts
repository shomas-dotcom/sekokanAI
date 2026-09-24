import { describe, expect, it } from "vitest";
import {
  jstWallTimeToUtc,
  computeWorkMinutes,
  computeNightShiftMinutes,
  mergeWorkIntervals,
} from "@/lib/timesheet/time";

// 調査報告(2026-09-24)の T02〜T04・T19 に対応する試験。

const day = new Date(Date.UTC(2026, 9, 1)); // 2026-10-01
const at = (hhmm: string) => jstWallTimeToUtc(day, hhmm);

describe("computeWorkMinutes の入力検証", () => {
  it("8〜17時・休憩120分は420分(従来どおり)", () => {
    expect(computeWorkMinutes("08:00", "17:00", 120)).toBe(420);
  });
  it("存在しない時刻(25:99)は受け付けない", () => {
    expect(computeWorkMinutes("08:00", "25:99", 60)).toBeNull();
  });
  it("負の休憩は受け付けない(実働が水増しされない)", () => {
    expect(computeWorkMinutes("08:00", "17:00", -60)).toBeNull();
  });
  it("小数の休憩は受け付けない", () => {
    expect(computeWorkMinutes("08:00", "17:00", 30.5)).toBeNull();
  });
});

describe("computeNightShiftMinutes の早朝", () => {
  it("4時〜8時の勤務は、4時〜5時の60分が深夜になる", () => {
    expect(computeNightShiftMinutes(at("04:00"), at("08:00"), "22:00", "05:00")).toBe(60);
  });
  it("22時〜翌3時は300分(従来どおり)", () => {
    expect(computeNightShiftMinutes(at("22:00"), at("03:00"), "22:00", "05:00")).toBe(300);
  });
  it("8時〜17時は0分", () => {
    expect(computeNightShiftMinutes(at("08:00"), at("17:00"), "22:00", "05:00")).toBe(0);
  });
});

describe("mergeWorkIntervals(同じ日の複数現場)", () => {
  it("午前3時間+午後4時間は7時間に合算され、出勤は最初・退勤は最後", () => {
    const merged = mergeWorkIntervals([
      { start: at("08:00"), end: at("11:00"), breakMinutes: 0, workMinutes: 180 },
      { start: at("13:00"), end: at("17:00"), breakMinutes: 0, workMinutes: 240 },
    ]);
    expect(merged.workMinutes).toBe(420);
    expect(merged.clockIn?.getTime()).toBe(at("08:00")?.getTime());
    expect(merged.clockOut?.getTime()).toBe(at("17:00")?.getTime());
    expect(merged.overlaps).toBe(false);
  });

  it("反映順が逆でも同じ結果になる", () => {
    const merged = mergeWorkIntervals([
      { start: at("13:00"), end: at("17:00"), breakMinutes: 0, workMinutes: 240 },
      { start: at("08:00"), end: at("11:00"), breakMinutes: 0, workMinutes: 180 },
    ]);
    expect(merged.workMinutes).toBe(420);
    expect(merged.clockIn?.getTime()).toBe(at("08:00")?.getTime());
  });

  it("時間帯が重なっていれば overlaps=true(合算して二重計上しない)", () => {
    const merged = mergeWorkIntervals([
      { start: at("08:00"), end: at("12:00"), breakMinutes: 0, workMinutes: 240 },
      { start: at("11:00"), end: at("17:00"), breakMinutes: 60, workMinutes: 300 },
    ]);
    expect(merged.overlaps).toBe(true);
  });

  it("同じ作業員を2回送った(同じ時間帯)場合も overlaps=true", () => {
    const same = { start: at("08:00"), end: at("17:00"), breakMinutes: 120, workMinutes: 420 };
    expect(mergeWorkIntervals([same, { ...same }]).overlaps).toBe(true);
  });

  it("11時終了と11時開始は重なりではない", () => {
    const merged = mergeWorkIntervals([
      { start: at("08:00"), end: at("11:00"), breakMinutes: 0, workMinutes: 180 },
      { start: at("11:00"), end: at("15:00"), breakMinutes: 0, workMinutes: 240 },
    ]);
    expect(merged.overlaps).toBe(false);
  });

  it("休憩は合計される", () => {
    const merged = mergeWorkIntervals([
      { start: at("08:00"), end: at("12:00"), breakMinutes: 30, workMinutes: 210 },
      { start: at("13:00"), end: at("17:00"), breakMinutes: 30, workMinutes: 210 },
    ]);
    expect(merged.breakMinutes).toBe(60);
    expect(merged.workMinutes).toBe(420);
  });
});
