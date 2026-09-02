"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { prisma } from "@/lib/prisma";

async function logAdminAction(adminId: string, action: string, companyId?: string) {
  await prisma.platformAdminAuditLog.create({ data: { adminId, action, companyId } });
}

export async function suspendCompanyAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  await prisma.company.update({
    where: { id: companyId },
    data: { isSuspended: true, suspendedAt: new Date(), suspendedReason: reason },
  });
  await logAdminAction(admin.id, "company.suspend", companyId);

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${companyId}`);
}

export async function resumeCompanyAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");

  await prisma.company.update({
    where: { id: companyId },
    data: { isSuspended: false, suspendedAt: null, suspendedReason: null },
  });
  await logAdminAction(admin.id, "company.resume", companyId);

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${companyId}`);
}

// 契約会社に新しい料金プラン(ライト/スタンダード/プロ等)を割り当てる。
// 実際の課金可否(Stripeのsubscription状態)は変えない — あくまで「どのプランで
// 契約している表示にするか」の割り当て。
export async function assignCompanyPlanAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const pricingPlanId = String(formData.get("pricingPlanId") ?? "").trim() || null;

  await prisma.company.update({ where: { id: companyId }, data: { pricingPlanId } });
  await logAdminAction(admin.id, `company.assignPlan:${pricingPlanId ?? "none"}`, companyId);

  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}

// 契約会社に対する商談・問い合わせ履歴を1件追記する(削除・編集は今回のスコープ外)。
export async function addCompanyNoteAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const type = String(formData.get("type") ?? "MEETING") as "MEETING" | "INQUIRY";
  const content = String(formData.get("content") ?? "").trim();
  if (!content) redirect(`/admin/companies/${companyId}`);

  await prisma.companyNote.create({
    data: { companyId, type, content, createdByAdminId: admin.id },
  });
  await logAdminAction(admin.id, `company.addNote:${type}`, companyId);

  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}`);
}
