"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { jstWallTimeToUtc, computeAttendanceBreakdown, computeNightShiftMinutes } from "@/lib/timesheet/time";
import type { WorkCategory } from "@/generated/prisma/enums";

const WORK_CATEGORIES: WorkCategory[] = [
  "NORMAL",
  "HOLIDAY_WORK",
  "PAID_LEAVE",
  "HALF_DAY_LEAVE",
  "ABSENCE",
  "LATE",
  "EARLY_LEAVE",
];

/**
 * 自分の勤怠(下書き・差し戻し中のみ)を修正する。氏名・メールアドレスでの本人確認はせず、
 * 必ずUser.employeeIdで紐づいた本人の記録かどうかを確認する(なりすまし防止)。
 */
export async function updateMyAttendanceAction(formData: FormData) {
  const user = await requireUser();
  if (!user.employeeId) return;
  const id = String(formData.get("id") ?? "");

  const attendance = await prisma.attendance.findFirst({
    where: { id, employeeId: user.employeeId, companyId: user.companyId },
  });
  if (!attendance) return;
  if (attendance.status !== "DRAFT" && attendance.status !== "REJECTED") return;

  const clockInStr = String(formData.get("clockInTime") ?? "").trim() || null;
  const clockOutStr = String(formData.get("clockOutTime") ?? "").trim() || null;
  const breakMinutesStr = String(formData.get("breakMinutes") ?? "").trim();
  const workCategoryRaw = String(formData.get("workCategory") ?? "NORMAL");
  const workCategory: WorkCategory = WORK_CATEGORIES.includes(workCategoryRaw as WorkCategory)
    ? (workCategoryRaw as WorkCategory)
    : "NORMAL";
  const remarks = String(formData.get("remarks") ?? "").trim() || null;

  const clockInTime = clockInStr ? jstWallTimeToUtc(attendance.targetDate, clockInStr) : attendance.clockInTime;
  const clockOutTime = clockOutStr ? jstWallTimeToUtc(attendance.targetDate, clockOutStr) : attendance.clockOutTime;
  const breakMinutes = breakMinutesStr ? Number(breakMinutesStr) : attendance.breakMinutes;

  let actualWorkMinutes = attendance.actualWorkMinutes;
  if (clockInTime && clockOutTime) {
    const diffMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000) - breakMinutes;
    actualWorkMinutes = diffMinutes > 0 ? diffMinutes : null;
  }

  const settings = await getOrCreateWorkSettings(user.companyId);
  const breakdown = computeAttendanceBreakdown({
    actualWorkMinutes,
    workCategory,
    scheduledWorkMinutes: settings.scheduledWorkMinutes,
  });
  const nightShiftMinutes = computeNightShiftMinutes(
    clockInTime,
    clockOutTime,
    settings.nightShiftStartTime,
    settings.nightShiftEndTime
  );

  await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      clockInTime,
      clockOutTime,
      breakMinutes,
      actualWorkMinutes,
      normalWorkMinutes: breakdown.normalWorkMinutes,
      overtimeMinutes: breakdown.overtimeMinutes,
      holidayWorkMinutes: breakdown.holidayWorkMinutes,
      nightShiftMinutes,
      workCategory,
      isPaidLeave: workCategory === "PAID_LEAVE" || workCategory === "HALF_DAY_LEAVE",
      isAbsence: workCategory === "ABSENCE",
      isLate: workCategory === "LATE",
      isEarlyLeave: workCategory === "EARLY_LEAVE",
      remarks,
      updatedByUserId: user.id,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "attendance.update",
    targetType: "Attendance",
    targetId: attendance.id,
  });

  revalidatePath("/attendance");
}

export async function submitMyAttendanceAction(formData: FormData) {
  const user = await requireUser();
  if (!user.employeeId) return;
  const id = String(formData.get("id") ?? "");

  const attendance = await prisma.attendance.findFirst({
    where: { id, employeeId: user.employeeId, companyId: user.companyId },
  });
  if (!attendance) return;
  if (attendance.status !== "DRAFT" && attendance.status !== "REJECTED") return;

  await prisma.attendance.update({
    where: { id: attendance.id },
    data: { status: "SUBMITTED", submittedAt: new Date(), rejectionReason: null },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "attendance.submit",
    targetType: "Attendance",
    targetId: attendance.id,
  });

  revalidatePath("/attendance");
}
