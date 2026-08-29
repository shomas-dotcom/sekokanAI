import { describe, expect, it } from "vitest";
import { isRateStale, defaultQuoteExpirationDate, RATE_STALE_MONTHS, DEFAULT_QUOTE_VALIDITY_MONTHS } from "@/lib/rateMaster";

describe("isRateStale", () => {
  it("3ヶ月以上前の更新は古いと判定する", () => {
    const now = new Date("2026-08-29T00:00:00Z");
    const fourMonthsAgo = new Date("2026-04-01T00:00:00Z");
    expect(isRateStale(fourMonthsAgo, now)).toBe(true);
  });

  it("3ヶ月未満前の更新は古いと判定しない", () => {
    const now = new Date("2026-08-29T00:00:00Z");
    const oneMonthAgo = new Date("2026-07-29T00:00:00Z");
    expect(isRateStale(oneMonthAgo, now)).toBe(false);
  });

  it("しきい値は3ヶ月", () => {
    expect(RATE_STALE_MONTHS).toBe(3);
  });
});

describe("defaultQuoteExpirationDate", () => {
  it("既定で3ヶ月後の日付を返す", () => {
    const from = new Date(2026, 0, 15); // 2026年1月15日(ローカル時刻で生成し、実装のsetMonthと同じ基準で比較する)
    const result = defaultQuoteExpirationDate(from);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // 0-indexed: 4月 = index 3
    expect(DEFAULT_QUOTE_VALIDITY_MONTHS).toBe(3);
  });
});
