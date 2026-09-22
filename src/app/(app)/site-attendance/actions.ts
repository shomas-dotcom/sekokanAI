"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { canManageProjectTimesheet } from "@/lib/timesheet/permissions";

async function writeChangeLog(params: {
  companyId: string;
  changedByUserId: string;
  entityId: string;
  changeType: "APPROVE" | "REJECT" | "CLOSE" | "REOPEN" | "UPDATE";
  before: string;
  after: string;
  reason?: string | null;
}) {
  await prisma.timesheetChangeLog.create({
    data: {
      companyId: params.companyId,
      entityType: "SITE_ATTENDANCE",
      entityId: params.entityId,
      changeType: params.changeType,
      beforeJson: JSON.stringify({ status: params.before }),
      afterJson: JSON.stringify({ status: params.after }),
      reason: params.reason ?? null,
      changedByUserId: params.changedByUserId,
    },
  });
}

/** 出面の人工単価を設定する(管理者のみ)。単価は給与相当の機微情報のため管理者専用。 */
export async function updateSiteAttendancePricingAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const unitPriceStr = String(formData.get("manDayUnitPrice") ?? "").trim();

  const record = await prisma.siteAttendance.findFirst({ where: { id, companyId: admin.companyId } });
  if (!record) return;
  if (record.status === "CLOSED") return;

  const manDayUnitPrice = unitPriceStr ? Number(unitPriceStr) : null;
  const amount = manDayUnitPrice != null ? Math.round(record.manDays * manDayUnitPrice) : null;

  await prisma.siteAttendance.update({
    where: { id },
    data: { manDayUnitPrice, amount, updatedByUserId: admin.id },
  });

  revalidatePath("/site-attendance");
}

/** 出面の承認。管理者は常に可、現場責任者はその現場を担当している場合のみ(一次承認)。 */
export async function approveSiteAttendanceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const record = await prisma.siteAttendance.findFirst({ where: { id, companyId: user.companyId } });
  if (!record || record.status !== "SUBMITTED") return;
  if (!(await canManageProjectTimesheet(user, record.projectId))) return;

  await prisma.siteAttendance.update({
    where: { id },
    data: { status: "APPROVED", approvedByUserId: user.id, approvedAt: new Date() },
  });
  await writeChangeLog({
    companyId: user.companyId,
    changedByUserId: user.id,
    entityId: id,
    changeType: "APPROVE",
    before: record.status,
    after: "APPROVED",
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "laborEntry.approve",
    targetType: "SiteAttendance",
    targetId: id,
  });

  revalidatePath("/site-attendance");
}

export async function rejectSiteAttendanceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`/site-attendance/${id}/reject?error=reason_required`);

  const record = await prisma.siteAttendance.findFirst({ where: { id, companyId: user.companyId } });
  if (!record || record.status !== "SUBMITTED") redirect("/site-attendance");
  if (!(await canManageProjectTimesheet(user, record.projectId))) redirect("/site-attendance");

  await prisma.siteAttendance.update({ where: { id }, data: { status: "REJECTED", rejectionReason: reason } });
  await writeChangeLog({
    companyId: user.companyId,
    changedByUserId: user.id,
    entityId: id,
    changeType: "REJECT",
    before: record.status,
    after: "REJECTED",
    reason,
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "laborEntry.update",
    targetType: "SiteAttendance",
    targetId: id,
  });

  revalidatePath("/site-attendance");
  redirect("/site-attendance");
}

export async function closeMonthSiteAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const monthStart = new Date(String(formData.get("monthStart") ?? ""));
  const monthEnd = new Date(String(formData.get("monthEnd") ?? ""));
  if (Number.isNaN(monthStart.getTime()) || Number.isNaN(monthEnd.getTime())) return;

  const targets = await prisma.siteAttendance.findMany({
    where: { companyId: admin.companyId, targetDate: { gte: monthStart, lt: monthEnd }, status: "APPROVED" },
  });
  await prisma.siteAttendance.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  for (const t of targets) {
    await writeChangeLog({
      companyId: admin.companyId,
      changedByUserId: admin.id,
      entityId: t.id,
      changeType: "CLOSE",
      before: t.status,
      after: "CLOSED",
    });
  }
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "laborEntry.export",
    targetType: "SiteAttendance",
    targetId: `bulk:${targets.length}`,
  });

  revalidatePath("/site-attendance");
}

export async function reopenSiteAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`/site-attendance/${id}/reopen?error=reason_required`);

  const record = await prisma.siteAttendance.findFirst({ where: { id, companyId: admin.companyId } });
  if (!record || record.status !== "CLOSED") redirect("/site-attendance");

  await prisma.siteAttendance.update({ where: { id }, data: { status: "APPROVED" } });
  await writeChangeLog({
    companyId: admin.companyId,
    changedByUserId: admin.id,
    entityId: id,
    changeType: "REOPEN",
    before: record.status,
    after: "APPROVED",
    reason,
  });
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "laborEntry.update",
    targetType: "SiteAttendance",
    targetId: id,
  });

  revalidatePath("/site-attendance");
  redirect("/site-attendance");
}
