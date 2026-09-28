import { describe, expect, it } from "vitest";
import { storageLimitMessage } from "@/lib/companyLimits";

const MB = 1024 * 1024;

describe("storageLimitMessage(保存容量の上限)", () => {
  it("上限が未設定なら常に保存できる", () => {
    expect(storageLimitMessage(10_000 * MB, 100 * MB, null)).toBeNull();
  });
  it("上限ちょうどまでは保存できる", () => {
    expect(storageLimitMessage(90 * MB, 10 * MB, 100 * MB)).toBeNull();
  });
  it("上限を1バイトでも超えるなら理由を返す", () => {
    const message = storageLimitMessage(90 * MB, 10 * MB + 1, 100 * MB);
    expect(message).toContain("100.0MB");
    expect(message).toContain("使用中 90.0MB");
  });
  it("上限0MBなら何も保存できない", () => {
    expect(storageLimitMessage(0, 1, 0)).not.toBeNull();
  });
});
