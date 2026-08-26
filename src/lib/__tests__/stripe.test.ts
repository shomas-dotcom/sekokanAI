import { describe, expect, it, afterEach } from "vitest";
import { isStripeConfigured, planForSubscriptionStatus } from "@/lib/stripe";

describe("planForSubscriptionStatus", () => {
  it("trialingとactiveはPREMIUM扱いにする", () => {
    expect(planForSubscriptionStatus("trialing")).toBe("PREMIUM");
    expect(planForSubscriptionStatus("active")).toBe("PREMIUM");
  });

  it("支払い遅延・解約済み・未払い等は安全側(FREE)に倒す", () => {
    expect(planForSubscriptionStatus("past_due")).toBe("FREE");
    expect(planForSubscriptionStatus("canceled")).toBe("FREE");
    expect(planForSubscriptionStatus("unpaid")).toBe("FREE");
    expect(planForSubscriptionStatus("incomplete_expired")).toBe("FREE");
  });
});

describe("isStripeConfigured", () => {
  const original = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = original;
  });

  it("STRIPE_SECRET_KEYが無い場合はfalse", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeConfigured()).toBe(false);
  });

  it("STRIPE_SECRET_KEYがある場合はtrue", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    expect(isStripeConfigured()).toBe(true);
  });
});
