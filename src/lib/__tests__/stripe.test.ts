import { describe, expect, it, afterEach, vi } from "vitest";
import { isStripeConfigured, isMockBillingAllowed, planForSubscriptionStatus } from "@/lib/stripe";

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

describe("isMockBillingAllowed(課金なしのデモ切替を使えるか)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("本番でStripe未設定なら使えない(誰でも無料で有料プランにできてしまうため)", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_BILLING", "");
    expect(isMockBillingAllowed()).toBe(false);
  });

  it("本番でもALLOW_MOCK_BILLING=trueなら使える", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_BILLING", "true");
    expect(isMockBillingAllowed()).toBe(true);
  });

  it("開発中でStripe未設定なら使える", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(isMockBillingAllowed()).toBe(true);
  });

  it("Stripe設定済みなら常に使えない", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_MOCK_BILLING", "true");
    expect(isMockBillingAllowed()).toBe(false);
  });
});
