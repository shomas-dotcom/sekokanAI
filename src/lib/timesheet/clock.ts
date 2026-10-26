import { prisma } from "@/lib/prisma";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { computeAttendanceBreakdown, computeNightShiftMinutes, formatJstTime } from "@/lib/timesheet/time";

// 勤怠ページの「出勤」「退勤」ボタン(打刻)の処理。
// 打刻の時刻は画面から受け取らず、必ずサーバーの現在時刻を使う(手元の時計をずらした打刻を防ぐ)。

/** 出勤時に選べる「今の案件」。受注・施工中のもの。 */
export const CLOCK_PROJECT_STATUSES: ProjectStatus[] = ["CONTRACTED", "IN_PROGRESS"];

/** 休憩を自動で差し引くのは、出勤〜退勤がこの分数を超えたときだけ(短時間の勤務から2時間引いて0にしない)。 */
const AUTO_BREAK_THRESHOLD_MINUTES = 6 * 60;

/**
 * 指定時刻が日本時間で何日かを、勤怠のtargetDateの形(その日のUTC 0時)で返す。
 * 日報から作られる勤怠も日報の日付(その日のUTC 0時)をそのまま使っているため、同じ形にしないと
 * 同じ日の勤怠が2件に分かれてしまう。
 */
export function jstTargetDate(now: Date): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
}

/**
 * 退勤時に差し引く休憩(分)。勤怠にすでに休憩が入っていればそれを使い、
 * なければ出勤〜退勤が6時間を超える場合だけ会社設定の休憩時間を使う。
 */
export function resolveBreakMinutes(spanMinutes: number, existingBreak: number, scheduledBreak: number): number {
  if (existingBreak > 0) return existingBreak;
  return spanMinutes > AUTO_BREAK_THRESHOLD_MINUTES ? scheduledBreak : 0;
}

export type ClockResult = { ok: true; message: string } | { ok: false; message: string };

type Actor = { userId: string; companyId: string; employeeId: string };

const LOCKED_MESSAGE = "この日の勤怠は提出済み(または承認済み)のため、打刻できません。管理者に連絡してください。";

export async function clockIn(actor: Actor, projectId: string, now: Date = new Date()): Promise<ClockResult> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: actor.companyId, status: { in: CLOCK_PROJECT_STATUSES } },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, message: "現場を選んでください。" };

  const targetDate = jstTargetDate(now);
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_targetDate: { employeeId: actor.employeeId, targetDate } },
  });

  if (!existing) {
    try {
      await prisma.attendance.create({
        data: {
          companyId: actor.companyId,
          employeeId: actor.employeeId,
          targetDate,
          projectId: project.id,
          clockInTime: now,
          clockInPunched: true,
          createdByUserId: actor.userId,
        },
      });
    } catch (error) {
      // ボタンの二度押しで同時に作ろうとした場合(従業員×日付の一意制約)。先に入った方を正とする。
      if ((error as { code?: string }).code === "P2002") {
        return { ok: false, message: "今日はすでに出勤しています。" };
      }
      throw error;
    }
    return { ok: true, message: `${formatJstTime(now)} 出勤しました(${project.name})` };
  }

  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") return { ok: false, message: LOCKED_MESSAGE };
  if (existing.clockInPunched) {
    return { ok: false, message: `今日はすでに ${formatJstTime(existing.clockInTime)} に出勤しています。` };
  }

  // 日報から先に作られていた勤怠: 出勤の時刻を打刻で置き換える(退勤・休憩は退勤の打刻で計算し直す)
  await prisma.attendance.update({
    where: { id: existing.id },
    data: { projectId: project.id, clockInTime: now, clockInPunched: true, updatedByUserId: actor.userId },
  });
  return { ok: true, message: `${formatJstTime(now)} 出勤しました(${project.name})` };
}

export async function clockOut(actor: Actor, now: Date = new Date()): Promise<ClockResult> {
  const today = jstTargetDate(now);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // 夜勤で日付をまたいだ場合に備え、今日→昨日の順に「出勤済み・未退勤」の勤怠を探す
  const open = await prisma.attendance.findFirst({
    where: {
      employeeId: actor.employeeId,
      companyId: actor.companyId,
      targetDate: { in: [today, yesterday] },
      clockInPunched: true,
      clockOutPunched: false,
    },
    orderBy: { targetDate: "desc" },
    include: { project: { select: { name: true } } },
  });

  if (!open || !open.clockInTime) {
    const done = await prisma.attendance.findUnique({
      where: { employeeId_targetDate: { employeeId: actor.employeeId, targetDate: today } },
    });
    if (done?.clockOutPunched) {
      return { ok: false, message: `今日はすでに ${formatJstTime(done.clockOutTime)} に退勤しています。` };
    }
    return { ok: false, message: "出勤の記録がありません。先に「出勤」を押してください。" };
  }
  if (open.status !== "DRAFT" && open.status !== "REJECTED") return { ok: false, message: LOCKED_MESSAGE };

  const settings = await getOrCreateWorkSettings(actor.companyId);
  const spanMinutes = Math.round((now.getTime() - open.clockInTime.getTime()) / 60000);
  const breakMinutes = resolveBreakMinutes(spanMinutes, open.breakMinutes, settings.scheduledBreakMinutes);
  const workMinutes = spanMinutes - breakMinutes;
  const actualWorkMinutes = workMinutes > 0 ? workMinutes : null;

  const breakdown = computeAttendanceBreakdown({
    actualWorkMinutes,
    workCategory: open.workCategory,
    scheduledWorkMinutes: settings.scheduledWorkMinutes,
  });
  // 出勤と退勤が同じ分(押し間違い等)だと、深夜の計算が「日をまたいだ24時間勤務」とみなしてしまうため計算しない
  const nightShiftMinutes =
    spanMinutes > 0
      ? computeNightShiftMinutes(open.clockInTime, now, settings.nightShiftStartTime, settings.nightShiftEndTime)
      : null;

  await prisma.attendance.update({
    where: { id: open.id },
    data: {
      clockOutTime: now,
      clockOutPunched: true,
      breakMinutes,
      actualWorkMinutes,
      normalWorkMinutes: breakdown.normalWorkMinutes,
      overtimeMinutes: breakdown.overtimeMinutes,
      holidayWorkMinutes: breakdown.holidayWorkMinutes,
      nightShiftMinutes,
      updatedByUserId: actor.userId,
    },
  });

  const hours = actualWorkMinutes != null ? `(実働 ${(actualWorkMinutes / 60).toFixed(1)}時間)` : "";
  return { ok: true, message: `${formatJstTime(now)} 退勤しました${hours}。お疲れさまでした。` };
}
