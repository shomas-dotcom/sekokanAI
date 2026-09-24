import { describe, expect, it } from "vitest";
import { createLoginThrottle } from "@/lib/loginThrottle";

describe("createLoginThrottle", () => {
  const t0 = 1_000_000;

  it("4回失敗まではロックされず、5回目でロックされる", () => {
    const throttle = createLoginThrottle(5, 15);
    for (let i = 0; i < 4; i++) throttle.recordFailure("a@example.com", t0);
    expect(throttle.isLocked("a@example.com", t0)).toBe(false);
    throttle.recordFailure("a@example.com", t0);
    expect(throttle.isLocked("a@example.com", t0)).toBe(true);
  });

  it("15分経てばロックが解け、回数も0からやり直す", () => {
    const throttle = createLoginThrottle(5, 15);
    for (let i = 0; i < 5; i++) throttle.recordFailure("a@example.com", t0);
    const after = t0 + 15 * 60 * 1000 + 1;
    expect(throttle.isLocked("a@example.com", after)).toBe(false);
    throttle.recordFailure("a@example.com", after);
    expect(throttle.isLocked("a@example.com", after)).toBe(false);
  });

  it("ログイン成功で失敗回数が消える", () => {
    const throttle = createLoginThrottle(5, 15);
    for (let i = 0; i < 4; i++) throttle.recordFailure("a@example.com", t0);
    throttle.recordSuccess("a@example.com");
    throttle.recordFailure("a@example.com", t0);
    expect(throttle.isLocked("a@example.com", t0)).toBe(false);
  });

  it("別のメールアドレスの失敗は影響しない", () => {
    const throttle = createLoginThrottle(5, 15);
    for (let i = 0; i < 5; i++) throttle.recordFailure("a@example.com", t0);
    expect(throttle.isLocked("b@example.com", t0)).toBe(false);
  });
});
