"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { clockIn, clockOut, type ClockResult } from "@/lib/timesheet/clock";

/** 勤怠ページの「出勤」「退勤」ボタン。どちらを押したかは送信ボタンの kind で受け取る。 */
export async function clockAction(_prev: ClockResult | undefined, formData: FormData): Promise<ClockResult> {
  const user = await requireUser();
  if (!user.employeeId) {
    return {
      ok: false,
      message: "ログイン利用者と従業員が関連付けられていないため、打刻できません。管理者に連絡してください。",
    };
  }
  const actor = { userId: user.id, companyId: user.companyId, employeeId: user.employeeId };
  const kind = String(formData.get("kind") ?? "");

  let result: ClockResult;
  if (kind === "in") {
    result = await clockIn(actor, String(formData.get("projectId") ?? ""));
  } else if (kind === "out") {
    result = await clockOut(actor);
  } else {
    return { ok: false, message: "「出勤」か「退勤」のボタンを押してください。" };
  }

  if (result.ok) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: kind === "in" ? "attendance.clockIn" : "attendance.clockOut",
      targetType: "Attendance",
    });
    revalidatePath("/clock");
    revalidatePath("/attendance");
  }
  return result;
}
