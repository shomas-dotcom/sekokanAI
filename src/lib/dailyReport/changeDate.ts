import type { Prisma } from "@/generated/prisma/client";

// 日報の日付を変えたとき、その日報から作られた勤怠・出面・機械の経費も同じ日に動かす。
// 動かせないもの(承認済み・締め済み等)が1つでもあれば、何も変えずに理由を返す
// (日付だけ変わって出面が元の日に残る、という食い違いを作らないため)。
//
// 既存の方針: 勤怠・出面は給与・請求の根拠なので、承認後は日報の修正で勝手に変わらない。
// 日付の変更も同じ扱いにして、承認前のものだけ動かす。

const SITE_ATTENDANCE_MOVABLE = ["DRAFT", "SUBMITTED", "REJECTED"];
const ATTENDANCE_MOVABLE = ["DRAFT", "REJECTED"];
const EXPENSE_MOVABLE = ["DRAFT"];

export type ChangeDateResult =
  | { ok: true; changed: boolean; movedSiteAttendances: number; movedAttendances: number; movedExpenses: number }
  | { ok: false; error: string };

const NOT_CHANGED: ChangeDateResult = {
  ok: true,
  changed: false,
  movedSiteAttendances: 0,
  movedAttendances: 0,
  movedExpenses: 0,
};

/**
 * 日報の日付を newDate(その日のUTC 0時。日報の保存と同じ形)に変える。トランザクション内で呼ぶこと。
 * 同じ会社の日報だけを対象にする(companyIdで絞る)。
 */
export async function changeDailyReportDate(
  db: Prisma.TransactionClient,
  params: { dailyReportId: string; companyId: string; newDate: Date }
): Promise<ChangeDateResult> {
  const report = await db.dailyReport.findFirst({
    where: { id: params.dailyReportId, companyId: params.companyId },
    include: {
      workers: { include: { attendance: true, siteAttendance: true } },
      machineUsages: { include: { siteExpenseEntry: true } },
    },
  });
  if (!report) return { ok: false, error: "日報が見つかりません。" };
  if (Number.isNaN(params.newDate.getTime())) return { ok: false, error: "日付の形式が正しくありません。" };
  if (report.reportDate.getTime() === params.newDate.getTime()) return NOT_CHANGED;

  const deltaMs = params.newDate.getTime() - report.reportDate.getTime();
  const shift = (d: Date | null): Date | null => (d ? new Date(d.getTime() + deltaMs) : null);

  // 動かすものを集める(同じ勤怠・出面を複数の明細が指していても1回だけ動かす)。
  const siteAttendances = new Map<string, NonNullable<(typeof report.workers)[number]["siteAttendance"]>>();
  const attendances = new Map<string, { attendance: NonNullable<(typeof report.workers)[number]["attendance"]>; workerName: string }>();
  for (const w of report.workers) {
    if (w.siteAttendance) siteAttendances.set(w.siteAttendance.id, w.siteAttendance);
    if (w.attendance) attendances.set(w.attendance.id, { attendance: w.attendance, workerName: w.workerName });
  }
  const expenses = new Map<string, NonNullable<(typeof report.machineUsages)[number]["siteExpenseEntry"]>>();
  for (const u of report.machineUsages) {
    if (u.siteExpenseEntry) expenses.set(u.siteExpenseEntry.id, u.siteExpenseEntry);
  }

  // --- 動かせないものがないか先に全部調べる(途中まで動かして止まることがないように) ---
  for (const sa of siteAttendances.values()) {
    if (!SITE_ATTENDANCE_MOVABLE.includes(sa.status)) {
      return {
        ok: false,
        error: `「${sa.workerName}」の出面が承認済み・締め済みのため、日付を変更できません。出面の承認を差し戻してから変更してください。`,
      };
    }
  }
  for (const { attendance, workerName } of attendances.values()) {
    if (!ATTENDANCE_MOVABLE.includes(attendance.status)) {
      return {
        ok: false,
        error: `「${workerName}」の勤怠が提出済み・承認済み・締め済みのため、日付を変更できません。勤怠を差し戻してから変更してください。`,
      };
    }
    // 同じ人が同じ日の別の日報にも入っていて勤怠が1日分にまとめられている場合は、
    // 一部だけ動かすと時間の合計が狂うため動かさない。
    const sharedWith = await db.dailyReportWorker.count({
      where: { attendanceId: attendance.id, dailyReportId: { not: report.id } },
    });
    if (sharedWith > 0) {
      return {
        ok: false,
        error: `「${workerName}」は同じ日の別の日報にも入っていて、勤怠が1日分にまとめられているため、日付を変更できません。勤怠の画面で確認してください。`,
      };
    }
    // 新しい日にその人の勤怠がすでにあると、1人1日1件のきまりに反するため動かさない。
    const conflict = await db.attendance.findFirst({
      where: {
        employeeId: attendance.employeeId,
        targetDate: params.newDate,
        id: { not: attendance.id },
      },
    });
    if (conflict) {
      return {
        ok: false,
        error: `「${workerName}」は変更先の日にすでに勤怠があるため、日付を変更できません。勤怠の画面で確認してください。`,
      };
    }
  }
  for (const e of expenses.values()) {
    if (!EXPENSE_MOVABLE.includes(e.status)) {
      return { ok: false, error: `「${e.name}」の経費が確定済みのため、日付を変更できません。` };
    }
  }

  // --- ここから実際に動かす ---
  await db.dailyReport.update({ where: { id: report.id }, data: { reportDate: params.newDate } });

  for (const sa of siteAttendances.values()) {
    await db.siteAttendance.update({
      where: { id: sa.id },
      data: { targetDate: params.newDate, startTime: shift(sa.startTime), endTime: shift(sa.endTime) },
    });
  }
  for (const { attendance } of attendances.values()) {
    await db.attendance.update({
      where: { id: attendance.id },
      data: {
        targetDate: params.newDate,
        clockInTime: shift(attendance.clockInTime),
        clockOutTime: shift(attendance.clockOutTime),
        siteArrivalTime: shift(attendance.siteArrivalTime),
        siteDepartureTime: shift(attendance.siteDepartureTime),
      },
    });
  }
  for (const e of expenses.values()) {
    await db.siteExpenseEntry.update({ where: { id: e.id }, data: { targetDate: params.newDate } });
  }

  return {
    ok: true,
    changed: true,
    movedSiteAttendances: siteAttendances.size,
    movedAttendances: attendances.size,
    movedExpenses: expenses.size,
  };
}
