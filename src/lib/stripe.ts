import Stripe from "stripe";

// Stripe連携の抽象化レイヤー。STRIPE_SECRET_KEY未設定時は「未設定」を明示し、
// 呼び出し側が開発用の疑似トライアル(実際の課金は発生しない)にフォールバック
// できるようにする(src/lib/ai/index.ts, src/lib/email.ts と同じ考え方)。

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export async function createCheckoutSession(params: {
  companyId: string;
  customerEmail: string;
  existingStripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not set");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { trial_period_days: 14 },
    customer: params.existingStripeCustomerId ?? undefined,
    customer_email: params.existingStripeCustomerId ? undefined : params.customerEmail,
    client_reference_id: params.companyId,
    metadata: { companyId: params.companyId },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

/**
 * Stripeのsubscription.statusから、自社の会社プラン(FREE/PREMIUM)を決める。
 * trialing/activeのみプレミアム扱いとし、それ以外(支払い遅延・解約済み等)は
 * 安全側(FREE)に倒す。判定をここに集約し、Webhookハンドラ内に散らばらせない。
 */
export function planForSubscriptionStatus(status: string): "PREMIUM" | "FREE" {
  return status === "trialing" || status === "active" ? "PREMIUM" : "FREE";
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
