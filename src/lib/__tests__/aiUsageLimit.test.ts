import { describe, expect, it } from "vitest";
import { isOverLimit, jstMonthStart, parseLimit, resolveCompanyLimit } from "@/lib/aiUsageLimit";

describe("parseLimit", () => {
  it("空・マイナス・小数・文字は未設定(無制限)", () => {
    expect(parseLimit("")).toBeNull();
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit("-1")).toBeNull();
    expect(parseLimit("1.5")).toBeNull();
    expect(parseLimit("abc")).toBeNull();
  });
  it("0以上の整数はそのまま", () => {
    expect(parseLimit("0")).toBe(0);
    expect(parseLimit("300")).toBe(300);
    expect(parseLimit(50)).toBe(50);
  });
});

describe("resolveCompanyLimit", () => {
  it("プランの上限を優先する", () => expect(resolveCompanyLimit(500, 100)).toBe(500));
  it("プランに上限がなければ既定値", () => expect(resolveCompanyLimit(null, 100)).toBe(100));
  it("どちらもなければ無制限", () => expect(resolveCompanyLimit(null, null)).toBeNull());
});

describe("isOverLimit", () => {
  it("上限ちょうどで止まる(上限100なら100回目までは使え、101回目で止まる)", () => {
    expect(isOverLimit(99, 100)).toBe(false);
    expect(isOverLimit(100, 100)).toBe(true);
  });
  it("上限0は使わせない", () => expect(isOverLimit(0, 0)).toBe(true));
  it("無制限なら止めない", () => expect(isOverLimit(1_000_000, null)).toBe(false));
});

describe("jstMonthStart", () => {
  it("日本時間10/1の朝7時(UTCでは9/30)は10月として数える", () => {
    expect(jstMonthStart(new Date("2026-09-30T22:00:00Z")).toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });
  it("日本時間9/30の23時は9月", () => {
    expect(jstMonthStart(new Date("2026-09-30T14:00:00Z")).toISOString()).toBe("2026-08-31T15:00:00.000Z");
  });
});
