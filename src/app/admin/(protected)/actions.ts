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
