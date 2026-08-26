import { describe, expect, it } from "vitest";
import { hash, verify } from "@/lib/password";

describe("password hash/verify", () => {
  it("正しいパスワードで検証が通る", async () => {
    const stored = await hash("correct-password-123");
    expect(await verify("correct-password-123", stored)).toBe(true);
  });

  it("誤ったパスワードでは検証が通らない", async () => {
    const stored = await hash("correct-password-123");
    expect(await verify("wrong-password", stored)).toBe(false);
  });

  it("平文のまま保存されない(saltとhashが含まれる形式になっている)", async () => {
    const stored = await hash("correct-password-123");
    expect(stored).not.toContain("correct-password-123");
    expect(stored.split(":")).toHaveLength(2);
  });

  it("同じパスワードでも毎回異なるハッシュになる(salt付き)", async () => {
    const a = await hash("same-password");
    const b = await hash("same-password");
    expect(a).not.toBe(b);
  });

  it("壊れた形式のハッシュに対してはfalseを返す(例外を投げない)", async () => {
    expect(await verify("anything", "not-a-valid-hash")).toBe(false);
  });
});
