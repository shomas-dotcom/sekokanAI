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

// 会社を選ばず各自でログイン画面から新規登録すると、その人専用の新しい会社が
// 作られてしまい、本来同じ会社の同僚とデータを共有できない状態になる
// (settings/team側の招待は既存メールアドレスを拒否するため、後から招待し直せない)。
// この操作は、そうして誤って1人だけの会社になってしまった利用者を、正しい
// 会社へ付け替える救済処置。安全のため「移動元の会社に他の利用者がいない」
// 場合のみ許可し(複数人いる会社を巻き込んで壊さないため)、移動元の空の
// 会社はそのまま削除する。
export async function moveUserIntoCompanyAction(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { company: { include: { _count: { select: { users: true } } } } },
  });
  if (!user) redirect(`/admin/companies/${companyId}?userMoveError=not_found`);
  if (user!.companyId === companyId) redirect(`/admin/companies/${companyId}?userMoveError=already_member`);
  if (user!.company._count.users > 1) redirect(`/admin/companies/${companyId}?userMoveError=not_alone`);

  const oldCompanyId = user!.companyId;
  await prisma.user.update({ where: { id: user!.id }, data: { companyId, role: "MEMBER" } });
  await prisma.company.delete({ where: { id: oldCompanyId } });
  await logAdminAction(admin.id, `user.move:${email}`, companyId);

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
