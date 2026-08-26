"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { isStripeConfigured, createCheckoutSession, createBillingPortalSession } from "@/lib/stripe";

export type BillingState = { error?: string } | undefined;

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export async function startSubscriptionAction(
  _prevState: BillingState,
  _formData: FormData
): Promise<BillingState> {
  const user = await requireAdmin();

  if (!isStripeConfigured()) {
    // 開発用の疑似トライアル。実際の決済は一切発生しない。
    // Stripe未設定の環境でも、契約〜プレミアム機能利用までの流れを確認できるようにする。
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await prisma.company.update({
      where: { id: user.companyId },
      data: { subscriptionStatus: "trialing", trialEndsAt, plan: "PREMIUM" },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "billing.mockTrialStart",
      targetType: "Company",
      targetId: user.companyId,
    });
    redirect("/billing?mock=trialStarted");
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const url = await createCheckoutSession({
    companyId: user.companyId,
    customerEmail: user.email,
    existingStripeCustomerId: company.stripeCustomerId,
    successUrl: `${appUrl()}/billing?checkout=success`,
    cancelUrl: `${appUrl()}/billing?checkout=cancelled`,
  });
  redirect(url);
}

export async function openBillingPortalAction(
  _prevState: BillingState,
  _formData: FormData
): Promise<BillingState> {
  const user = await requireAdmin();

  if (!isStripeConfigured()) {
    return { error: "Stripeが未設定のため、支払い方法の管理はまだご利用いただけません。" };
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
  if (!company.stripeCustomerId) {
    return { error: "契約情報が見つかりません。先にプランへの登録を行ってください。" };
  }

  const url = await createBillingPortalSession({
    stripeCustomerId: company.stripeCustomerId,
    returnUrl: `${appUrl()}/billing`,
  });
  redirect(url);
}
