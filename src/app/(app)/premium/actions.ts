"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

/**
 * デモ用のプラン切り替え。実際の決済は行わない(no-billing-without-confirmation)。
 * 管理者のみ実行可能。本番では決済サービスのWebhook等から更新する想定。
 */
export async function togglePlanAction() {
  const user = await requireAdmin();
  const current = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const next = current.plan === "PREMIUM" ? "FREE" : "PREMIUM";

  await prisma.company.update({ where: { id: user.companyId }, data: { plan: next } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "company.togglePlan",
    targetType: "Company",
    targetId: user.companyId,
  });

  revalidatePath("/premium");
  redirect("/premium");
}
