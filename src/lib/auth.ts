import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // セッション発行後に退会・会社の利用停止が行われた場合、次のアクセスで即座に遮断する。
  if (user.deletedAt) {
    await destroySession();
    redirect("/login");
  }
  if (user.company.isSuspended) {
    await destroySession();
    redirect("/suspended");
  }

  // Stripe未設定(開発用の疑似トライアル)の場合のみ、ここで期限切れを判定する。
  // Stripe設定済みの本番では、実際の状態変化はWebhookが更新するためここでは何もしない。
  if (
    !isStripeConfigured() &&
    user.company.subscriptionStatus === "trialing" &&
    user.company.trialEndsAt &&
    user.company.trialEndsAt < new Date()
  ) {
    await prisma.company.update({
      where: { id: user.companyId },
      data: { subscriptionStatus: "canceled", plan: "FREE" },
    });
    user.company.subscriptionStatus = "canceled";
    user.company.plan = "FREE";
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
