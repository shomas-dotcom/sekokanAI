import { describe, expect, it } from "vitest";
import { isExpired, isExpiringSoon, QUALIFICATION_WARNING_DAYS } from "@/lib/qualifications";

const now = new Date("2026-08-26T00:00:00Z");
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

describe("isExpired", () => {
  it("期限がnullの場合は期限切れ扱いにしない", () => {
    expect(isExpired(null, now)).toBe(false);
  });
  it("期限が過去の場合はtrue", () => {
    expect(isExpired(daysFromNow(-1), now)).toBe(true);
  });
  it("期限が今日以降の場合はfalse", () => {
    expect(isExpired(daysFromNow(0), now)).toBe(false);
  });
});

describe("isExpiringSoon", () => {
  it("期限がnullの場合はfalse", () => {
    expect(isExpiringSoon(null, now)).toBe(false);
  });
  it("既に期限切れの場合はfalse(isExpiredで扱うため二重に警告しない)", () => {
    expect(isExpiringSoon(daysFromNow(-1), now)).toBe(false);
  });
  it(`${QUALIFICATION_WARNING_DAYS}日以内はtrue`, () => {
    expect(isExpiringSoon(daysFromNow(QUALIFICATION_WARNING_DAYS), now)).toBe(true);
  });
  it(`${QUALIFICATION_WARNING_DAYS}日より先はfalse`, () => {
    expect(isExpiringSoon(daysFromNow(QUALIFICATION_WARNING_DAYS + 1), now)).toBe(false);
  });
});
