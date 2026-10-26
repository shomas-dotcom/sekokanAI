import { prisma } from "@/lib/prisma";

// 個人別の月間出勤簿(画面・印刷・PDF)で使う、対象月と対象者の決め方と、日ごとの行の組み立て。

/** "YYYY-MM"を年・月に。不正・未指定なら日本時間の今月。 */
export function parseMonthParam(monthParam: string | undefined, now: Date = new Date()): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month };
  }
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export function monthParamString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 出勤簿の対象の従業員を決める。管理者だけが他の人(同じ会社の従業員)を指定できる。
 * それ以外は必ず本人(User.employeeId)。見つからなければnull。
 */
export async function resolveSheetEmployee(
  user: { role: string; companyId: string; employeeId: string | null },
  employeeIdParam: string | undefined
) {
  const employeeId = user.role === "ADMIN" && employeeIdParam ? employeeIdParam : user.employeeId;
  if (!employeeId) return null;
  return prisma.employee.findFirst({
    where: { id: employeeId, companyId: user.companyId },
    select: { id: true, name: true },
  });
}

/** 分を"h:mm"に。nullや0は空欄。 */
export function formatHm(minutes: number | null | undefined): string {
  if (!minutes) return "";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export async function loadMonthlySheet(companyId: string, employeeId: string, year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, -9, 0)); // その月1日のJST0時
  const monthEnd = new Date(Date.UTC(year, month, 1, -9, 0));
  const records = await prisma.attendance.findMany({
    where: { companyId, employeeId, targetDate: { gte: monthStart, lt: monthEnd } },
    include: {
      project: { select: { name: true } },
      sourceDailyReport: { select: { project: { select: { name: true } } } },
    },
    orderBy: { targetDate: "asc" },
  });

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const targetDate = new Date(Date.UTC(year, month - 1, day)); // 勤怠のtargetDateはその日のUTC 0時
    const record = records.find((r) => r.targetDate.getTime() === targetDate.getTime()) ?? null;
    return {
      day,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
      record,
      // 打刻で選んだ現場を優先し、なければ反映元の日報の現場
      siteName: record?.project?.name ?? record?.sourceDailyReport?.project.name ?? "",
    };
  });

  const totals = {
    workDays: records.filter((r) => r.clockInTime || (r.actualWorkMinutes ?? 0) > 0).length,
    actualWorkMinutes: records.reduce((sum, r) => sum + (r.actualWorkMinutes ?? 0), 0),
    overtimeMinutes: records.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0),
    nightShiftMinutes: records.reduce((sum, r) => sum + (r.nightShiftMinutes ?? 0), 0),
    holidayWorkMinutes: records.reduce((sum, r) => sum + (r.holidayWorkMinutes ?? 0), 0),
    paidLeaveDays: records.filter((r) => r.isPaidLeave).length,
    absenceDays: records.filter((r) => r.isAbsence).length,
  };

  return { days, totals };
}
