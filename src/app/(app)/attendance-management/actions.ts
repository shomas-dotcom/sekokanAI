"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

async function writeChangeLog(params: {
  companyId: string;
  changedByUserId: string;
  entityId: string;
  changeType: "APPROVE" | "REJECT" | "CLOSE" | "REOPEN";
  before: string;
  after: string;
  reason?: string | null;
}) {
  await prisma.timesheetChangeLog.create({
    data: {
      companyId: params.companyId,
      entityType: "ATTENDANCE",
      entityId: params.entityId,
      changeType: params.changeType,
      beforeJson: JSON.stringify({ status: params.before }),
      afterJson: JSON.stringify({ status: params.after }),
      reason: params.reason ?? null,
      changedByUserId: params.changedByUserId,
    },
  });
}

export async function approveAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const attendance = await prisma.attendance.findFirst({ where: { id, companyId: admin.companyId } });
  if (!attendance || attendance.status !== "SUBMITTED") return;

  await prisma.attendance.update({
    where: { id },
    data: { status: "APPROVED", approvedByUserId: admin.id, approvedAt: new Date() },
  });
  await writeChangeLog({
    companyId: admin.companyId,
    changedByUserId: admin.id,
    entityId: id,
    changeType: "APPROVE",
    before: attendance.status,
    after: "APPROVED",
  });
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "attendance.approve",
    targetType: "Attendance",
    targetId: id,
  });

  revalidatePath("/attendance-management");
}

export async function bulkApproveAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const ids = formData.getAll("ids").map(String);
  if (ids.length === 0) return;

  const targets = await prisma.attendance.findMany({
    where: { id: { in: ids }, companyId: admin.companyId, status: "SUBMITTED" },
  });
  await prisma.attendance.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "APPROVED", approvedByUserId: admin.id, approvedAt: new Date() },
  });
  for (const t of targets) {
    await writeChangeLog({
      companyId: admin.companyId,
      changedByUserId: admin.id,
      entityId: t.id,
      changeType: "APPROVE",
      before: t.status,
      after: "APPROVED",
    });
  }
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "attendance.approve",
    targetType: "Attendance",
    targetId: `bulk:${targets.length}`,
  });

  revalidatePath("/attendance-management");
}

export async function rejectAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`/attendance-management/${id}/reject?error=reason_required`);

  const attendance = await prisma.attendance.findFirst({ where: { id, companyId: admin.companyId } });
  if (!attendance || attendance.status !== "SUBMITTED") redirect("/attendance-management");

  await prisma.attendance.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason },
  });
  await writeChangeLog({
    companyId: admin.companyId,
    changedByUserId: admin.id,
    entityId: id,
    changeType: "REJECT",
    before: attendance.status,
    after: "REJECTED",
    reason,
  });
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "attendance.reject",
    targetType: "Attendance",
    targetId: id,
  });

  revalidatePath("/attendance-management");
  redirect("/attendance-management");
}

/** 対象年月の承認済み勤怠をまとめて締める。締め済みデータは以後、通常の修正ができなくなる。 */
export async function closeMonthAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const monthStart = new Date(String(formData.get("monthStart") ?? ""));
  const monthEnd = new Date(String(formData.get("monthEnd") ?? ""));
  if (Number.isNaN(monthStart.getTime()) || Number.isNaN(monthEnd.getTime())) return;

  const targets = await prisma.attendance.findMany({
    where: { companyId: admin.companyId, targetDate: { gte: monthStart, lt: monthEnd }, status: "APPROVED" },
  });
  await prisma.attendance.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "CLOSED", closedAt: new Date(), closedByUserId: admin.id },
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
    action: "attendance.close",
    targetType: "Attendance",
    targetId: `bulk:${targets.length}`,
  });

  revalidatePath("/attendance-management");
}

/** 締め解除。理由入力を必須にし、履歴を残す(給与・請求に関わるため)。 */
export async function reopenAttendanceAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) redirect(`/attendance-management/${id}/reopen?error=reason_required`);

  const attendance = await prisma.attendance.findFirst({ where: { id, companyId: admin.companyId } });
  if (!attendance || attendance.status !== "CLOSED") redirect("/attendance-management");

  await prisma.attendance.update({
    where: { id },
    data: { status: "APPROVED", reopenedAt: new Date(), reopenReason: reason },
  });
  await writeChangeLog({
    companyId: admin.companyId,
    changedByUserId: admin.id,
    entityId: id,
    changeType: "REOPEN",
    before: attendance.status,
    after: "APPROVED",
    reason,
  });
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "attendance.reopen",
    targetType: "Attendance",
    targetId: id,
  });

  revalidatePath("/attendance-management");
  redirect("/attendance-management");
}
