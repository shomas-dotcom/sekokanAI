"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { isStripeConfigured } from "@/lib/stripe";

/**
 * デモ用のプラン切り替え。実際の決済は行わない。Stripe設定済みの環境では、
 * 実際の契約状態と食い違う操作をさせないためこの関数自体を無効化する
 * (画面側で隠すだけでなく、直接POSTされた場合にもここで必ず拒否する)。
 */
export async function togglePlanAction() {
  const user = await requireAdmin();
  if (isStripeConfigured()) redirect("/billing");
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
