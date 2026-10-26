import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PrintButton } from "@/components/PrintButton";
import { formatJstTime } from "@/lib/timesheet/time";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { formatHm, loadMonthlySheet, parseMonthParam, resolveSheetEmployee } from "@/lib/timesheet/monthlySheet";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

const CATEGORY_LABEL: Record<string, string> = {
  NORMAL: "",
  HOLIDAY_WORK: "休出",
  PAID_LEAVE: "有給",
  HALF_DAY_LEAVE: "半休",
  ABSENCE: "欠勤",
  LATE: "遅刻",
  EARLY_LEAVE: "早退",
  BUSINESS_TRIP: "出張",
  TRAVEL_DAY: "移動",
};

/** 個人別の月間出勤簿(印刷・PDF用)。PDFは /attendance/pdf がこの画面をそのままPDFにする。 */
export default async function AttendanceSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employeeId?: string }>;
}) {
  const { month: monthParam, employeeId: employeeIdParam } = await searchParams;
  const user = await requireUser();
  const employee = await resolveSheetEmployee(user, employeeIdParam);
  if (!employee) notFound();

  const { year, month } = parseMonthParam(monthParam);
  const [{ days, totals }, settings] = await Promise.all([
    loadMonthlySheet(user.companyId, employee.id, year, month),
    getOrCreateWorkSettings(user.companyId),
  ]);
  let holidayWeekdays: number[] = [0];
  try {
    holidayWeekdays = JSON.parse(settings.holidayWeekdaysJson);
  } catch {
    // 設定が壊れていても出勤簿は出す(日曜だけ色付け)
  }

  const cell = "border border-zinc-400 px-1 py-0.5";

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 print:max-w-none print:p-0">
      <style>{`@media print { @page { size: A4; margin: 10mm 10mm; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-xl font-bold text-zinc-900">
        出勤簿 {year}年{month}月
      </h1>
      <div className="mt-3 flex items-end justify-between text-sm text-zinc-800">
        <p>
          氏名: <span className="text-base font-semibold">{employee.name}</span>
        </p>
        <p className="text-zinc-600">{user.company.name}</p>
      </div>

      <table className="mt-2 w-full border-collapse text-[11px] leading-tight text-zinc-900">
        <thead className="bg-zinc-100">
          <tr>
            <th className={`${cell} w-7`}>日</th>
            <th className={`${cell} w-6`}>曜</th>
            <th className={cell}>現場</th>
            <th className={`${cell} w-11`}>出勤</th>
            <th className={`${cell} w-11`}>退勤</th>
            <th className={`${cell} w-10`}>休憩</th>
            <th className={`${cell} w-10`}>実働</th>
            <th className={`${cell} w-10`}>残業</th>
            <th className={`${cell} w-10`}>区分</th>
            <th className={`${cell} w-28`}>備考</th>
          </tr>
        </thead>
        <tbody>
          {days.map(({ day, weekday, record, siteName }) => (
            <tr key={day} className={holidayWeekdays.includes(weekday) ? "bg-rose-50" : weekday === 6 ? "bg-sky-50" : ""}>
              <td className={`${cell} text-center`}>{day}</td>
              <td className={`${cell} text-center`}>{WEEKDAY_JA[weekday]}</td>
              <td className={cell}>{siteName}</td>
              <td className={`${cell} text-center tabular-nums`}>{formatJstTime(record?.clockInTime)}</td>
              <td className={`${cell} text-center tabular-nums`}>{formatJstTime(record?.clockOutTime)}</td>
              <td className={`${cell} text-center tabular-nums`}>{formatHm(record?.breakMinutes)}</td>
              <td className={`${cell} text-center tabular-nums`}>{formatHm(record?.actualWorkMinutes)}</td>
              <td className={`${cell} text-center tabular-nums`}>{formatHm(record?.overtimeMinutes)}</td>
              <td className={`${cell} text-center`}>{record ? CATEGORY_LABEL[record.workCategory] : ""}</td>
              <td className={cell}>{record?.remarks ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-4">
        <table className="border-collapse text-xs text-zinc-900">
          <tbody>
            <tr>
              <th className={`${cell} bg-zinc-100 px-2`}>出勤日数</th>
              <td className={`${cell} px-3 text-right`}>{totals.workDays}日</td>
              <th className={`${cell} bg-zinc-100 px-2`}>実働合計</th>
              <td className={`${cell} px-3 text-right tabular-nums`}>{formatHm(totals.actualWorkMinutes) || "0:00"}</td>
              <th className={`${cell} bg-zinc-100 px-2`}>残業合計</th>
              <td className={`${cell} px-3 text-right tabular-nums`}>{formatHm(totals.overtimeMinutes) || "0:00"}</td>
            </tr>
            <tr>
              <th className={`${cell} bg-zinc-100 px-2`}>休日出勤</th>
              <td className={`${cell} px-3 text-right tabular-nums`}>{formatHm(totals.holidayWorkMinutes) || "0:00"}</td>
              <th className={`${cell} bg-zinc-100 px-2`}>深夜</th>
              <td className={`${cell} px-3 text-right tabular-nums`}>{formatHm(totals.nightShiftMinutes) || "0:00"}</td>
              <th className={`${cell} bg-zinc-100 px-2`}>有給 / 欠勤</th>
              <td className={`${cell} px-3 text-right`}>
                {totals.paidLeaveDays}日 / {totals.absenceDays}日
              </td>
            </tr>
          </tbody>
        </table>
        <table className="border-collapse text-xs text-zinc-900">
          <tbody>
            <tr>
              <th className={`${cell} w-16 bg-zinc-100`}>本人</th>
              <th className={`${cell} w-16 bg-zinc-100`}>確認</th>
            </tr>
            <tr>
              <td className={`${cell} h-14`} />
              <td className={`${cell} h-14`} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
