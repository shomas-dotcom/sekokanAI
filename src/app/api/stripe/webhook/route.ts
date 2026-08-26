import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { constructWebhookEvent, isStripeConfigured, planForSubscriptionStatus } from "@/lib/stripe";

// Stripeからのサーバー間通知(Webhook)。ここだけがサブスクリプションの状態を
// 更新する唯一の場所とし、クライアント側の表示だけで課金状態を判断しない
// (REQUIREMENTS.md/依頼元の要件)。セッションCookieではなく署名で本人性を検証する。
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 同一イベントの二重処理を防ぐ(Stripeは同じイベントを複数回送ってくることがある)
  const alreadyProcessed = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await handleEvent(event);

  return NextResponse.json({ received: true });
}

async function findCompanyId(
  companyIdFromMetadata: string | undefined,
  stripeCustomerId: string | null
): Promise<string | null> {
  if (companyIdFromMetadata) return companyIdFromMetadata;
  if (!stripeCustomerId) return null;
  const company = await prisma.company.findUnique({ where: { stripeCustomerId } });
  return company?.id ?? null;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = await findCompanyId(
        session.metadata?.companyId ?? session.client_reference_id ?? undefined,
        typeof session.customer === "string" ? session.customer : null
      );
      if (!companyId || typeof session.customer !== "string") break;

      await prisma.company.update({
        where: { id: companyId },
        data: { stripeCustomerId: session.customer },
      });
      await recordEvent(event, companyId, "月額プランへのお申し込みを受け付けました");
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = await findCompanyId(
        subscription.metadata?.companyId,
        typeof subscription.customer === "string" ? subscription.customer : null
      );
      if (!companyId) break;

      const status = subscription.status;
      const plan = planForSubscriptionStatus(status);
      const currentPeriodEndUnix = (subscription as unknown as { current_period_end?: number })
        .current_period_end;

      await prisma.company.update({
        where: { id: companyId },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status,
          plan,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        },
      });
      await recordEvent(event, companyId, `契約状態が更新されました(${status})`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = await findCompanyId(
        subscription.metadata?.companyId,
        typeof subscription.customer === "string" ? subscription.customer : null
      );
      if (!companyId) break;

      await prisma.company.update({
        where: { id: companyId },
        data: { subscriptionStatus: "canceled", plan: "FREE" },
      });
      await recordEvent(event, companyId, "契約が解約されました");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const companyId = await findCompanyId(
        undefined,
        typeof invoice.customer === "string" ? invoice.customer : null
      );
      if (!companyId) break;

      await recordEvent(event, companyId, "お支払いに失敗しました。カード情報をご確認ください");
      break;
    }

    default:
      // 未対応のイベント種別は記録のみ行い、無視する
      break;
  }
}

async function recordEvent(event: Stripe.Event, companyId: string, summary: string) {
  await prisma.billingEvent.create({
    data: { companyId, stripeEventId: event.id, type: event.type, summary },
  });
}
