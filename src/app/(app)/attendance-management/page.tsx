import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Select, Button } from "@/components/ui";
import { formatJstTime } from "@/lib/timesheet/time";
import { bulkApproveAttendanceAction, closeMonthAttendanceAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  APPROVED: "承認済み",
  REJECTED: "差し戻し",
  CLOSED: "締め済み",
};

export default async function AttendanceManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employeeId?: string; status?: string }>;
}) {
  const { month: monthParam, employeeId, status } = await searchParams;
  const admin = await requireAdmin();

  const now = new Date();
  const [y, m] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ where: { companyId: admin.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.attendance.findMany({
      where: {
        companyId: admin.companyId,
        targetDate: { gte: monthStart, lt: monthEnd },
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { employee: { select: { name: true } } },
      orderBy: [{ targetDate: "asc" }, { employee: { name: "asc" } }],
    }),
  ]);

  const submittedCount = records.filter((r) => r.status === "SUBMITTED").length;
  const approvedCount = records.filter((r) => r.status === "APPROVED").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">勤怠管理({y}年{m}月)</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/attendance-management?month=${prevMonth}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            前月
          </Link>
          <Link href={`/attendance-management?month=${nextMonth}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            翌月
          </Link>
          <a
            href={`/attendance-management/xlsx?month=${y}-${String(m).padStart(2, "0")}${employeeId ? `&employeeId=${employeeId}` : ""}`}
            className="rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-3 py-1.5 font-medium text-white"
          >
            勤怠表をExcelでダウンロード
          </a>
        </div>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="month" value={`${y}-${String(m).padStart(2, "0")}`} />
          <label className="flex flex-col gap-1 text-slate-600">
            従業員
            <Select name="employeeId" defaultValue={employeeId ?? ""}>
              <option value="">すべて</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-slate-600">
            ステータス
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">すべて</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            絞り込む
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            未承認(提出済み): <span className="font-medium text-slate-900">{submittedCount}件</span> / 承認済み(締め前):{" "}
            <span className="font-medium text-slate-900">{approvedCount}件</span>
          </p>
          <form action={closeMonthAttendanceAction}>
            <input type="hidden" name="monthStart" value={monthStart.toISOString()} />
            <input type="hidden" name="monthEnd" value={monthEnd.toISOString()} />
            <Button type="submit" variant="secondary" disabled={approvedCount === 0}>
              この月の承認済み分をまとめて締める({approvedCount}件)
            </Button>
          </form>
        </div>
      </Card>

      <Card>
        <form action={bulkApproveAttendanceAction}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 pr-2"></th>
                  <th className="py-1 pr-2">日付</th>
                  <th className="py-1 pr-2">従業員</th>
                  <th className="py-1 pr-2">出勤〜退勤</th>
                  <th className="py-1 pr-2">実働/残業(h)</th>
                  <th className="py-1 pr-2">区分</th>
                  <th className="py-1 pr-2">状態</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const anomaly = r.actualWorkMinutes == null && r.status !== "DRAFT";
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-1 pr-2">
                        {r.status === "SUBMITTED" && <input type="checkbox" name="ids" value={r.id} />}
                      </td>
                      <td className="py-1 pr-2">{r.targetDate.toLocaleDateString("ja-JP")}</td>
                      <td className="py-1 pr-2">{r.employee.name}</td>
                      <td className="py-1 pr-2">
                        {formatJstTime(r.clockInTime) || "—"}〜{formatJstTime(r.clockOutTime) || "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {r.actualWorkMinutes != null ? (r.actualWorkMinutes / 60).toFixed(1) : "—"}/
                        {r.overtimeMinutes != null ? (r.overtimeMinutes / 60).toFixed(1) : "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {anomaly && <span className="mr-1 text-amber-600">⚠</span>}
                        {r.workCategory}
                      </td>
                      <td className="py-1 pr-2">{STATUS_LABEL[r.status]}</td>
                      <td className="py-1 whitespace-nowrap">
                        {r.status === "SUBMITTED" && (
                          <Link href={`/attendance-management/${r.id}/reject`} className="text-xs text-rose-600 underline">
                            差し戻す
                          </Link>
                        )}
                        {r.status === "CLOSED" && (
                          <Link href={`/attendance-management/${r.id}/reopen`} className="text-xs text-slate-600 underline">
                            締め解除
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-3 text-center text-slate-500">
                      該当する勤怠がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button type="submit" variant="secondary" className="mt-3" disabled={submittedCount === 0}>
            チェックした分を一括承認
          </Button>
        </form>
      </Card>
    </div>
  );
}
