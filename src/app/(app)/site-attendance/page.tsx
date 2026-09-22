import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Button } from "@/components/ui";
import {
  approveSiteAttendanceAction,
  closeMonthSiteAttendanceAction,
  updateSiteAttendancePricingAction,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  APPROVED: "承認済み",
  REJECTED: "差し戻し",
  CLOSED: "締め済み",
};

const GROUP_LABEL: Record<string, string> = {
  project: "現場別",
  primeContractor: "元請別",
  employee: "従業員別",
  date: "日別",
  jobType: "職種別",
};

export default async function SiteAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; groupBy?: string }>;
}) {
  const { month: monthParam, groupBy = "project" } = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const now = new Date();
  const [y, m] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  // 従業員(一般社員・現場責任者)は自分の分だけ、管理者は全件見られる
  // (REQUIREMENTS.md/CLAUDE.mdの「従業員には単価と金額を見せない」方針も併せて適用する)。
  const scopeWhere = isAdmin
    ? { companyId: user.companyId }
    : { companyId: user.companyId, employeeId: user.employeeId ?? "__none__" };

  const records = await prisma.siteAttendance.findMany({
    where: { ...scopeWhere, targetDate: { gte: monthStart, lt: monthEnd } },
    include: { project: { select: { name: true, primeContractorName: true } } },
    orderBy: [{ targetDate: "asc" }],
  });

  const expenses = isAdmin
    ? await prisma.siteExpenseEntry.findMany({
        where: { companyId: user.companyId, targetDate: { gte: monthStart, lt: monthEnd } },
        include: { project: { select: { name: true } } },
      })
    : [];

  type Group = { key: string; manDays: number; workMinutes: number; laborCost: number; billing: number };
  const groups = new Map<string, Group>();
  for (const r of records) {
    let key: string;
    switch (groupBy) {
      case "primeContractor":
        key = r.project.primeContractorName ?? "(元請未設定)";
        break;
      case "employee":
        key = r.workerName;
        break;
      case "date":
        key = r.targetDate.toLocaleDateString("ja-JP");
        break;
      case "jobType":
        key = r.jobType ?? "(職種未設定)";
        break;
      default:
        key = r.project.name;
    }
    const g = groups.get(key) ?? { key, manDays: 0, workMinutes: 0, laborCost: 0, billing: 0 };
    g.manDays += r.manDays;
    g.workMinutes += r.workMinutes ?? 0;
    if (r.manDayUnitPrice != null) g.laborCost += r.manDays * r.manDayUnitPrice;
    if (r.isBillable && r.amount != null) g.billing += r.amount;
    groups.set(key, g);
  }
  const expenseTotal = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const vehicleTotalByProject = new Map<string, number>();
  for (const e of expenses) {
    vehicleTotalByProject.set(e.project.name, (vehicleTotalByProject.get(e.project.name) ?? 0) + (e.amount ?? 0));
  }

  const submittedCount = records.filter((r) => r.status === "SUBMITTED").length;
  const approvedCount = records.filter((r) => r.status === "APPROVED").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">出面・常用集計({y}年{m}月)</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/site-attendance?month=${prevMonth}&groupBy=${groupBy}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            前月
          </Link>
          <Link href={`/site-attendance?month=${nextMonth}&groupBy=${groupBy}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            翌月
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(GROUP_LABEL).map(([value, label]) => (
            <Link
              key={value}
              href={`/site-attendance?month=${y}-${String(m).padStart(2, "0")}&groupBy=${value}`}
              className={
                groupBy === value
                  ? "rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800"
                  : "rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">月間集計({GROUP_LABEL[groupBy] ?? groupBy})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">{GROUP_LABEL[groupBy] ?? groupBy}</th>
                <th className="py-1 pr-2">人工数</th>
                <th className="py-1 pr-2">作業時間(h)</th>
                {isAdmin && <th className="py-1 pr-2">労務原価</th>}
                {isAdmin && <th className="py-1 pr-2">請求予定額</th>}
              </tr>
            </thead>
            <tbody>
              {[...groups.values()].map((g) => (
                <tr key={g.key} className="border-t border-slate-100">
                  <td className="py-1 pr-2">{g.key}</td>
                  <td className="py-1 pr-2">{g.manDays}</td>
                  <td className="py-1 pr-2">{(g.workMinutes / 60).toFixed(1)}</td>
                  {isAdmin && <td className="py-1 pr-2">{g.laborCost.toLocaleString("ja-JP")}円</td>}
                  {isAdmin && <td className="py-1 pr-2">{g.billing.toLocaleString("ja-JP")}円</td>}
                </tr>
              ))}
              {groups.size === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 3} className="py-3 text-center text-slate-500">
                    データがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <p className="mt-2 text-xs text-slate-500">
            車両・重機・経費(月間合計): {expenseTotal.toLocaleString("ja-JP")}円 / 合計金額(労務+車両重機経費):{" "}
            {([...groups.values()].reduce((s, g) => s + g.billing, 0) + expenseTotal).toLocaleString("ja-JP")}円
          </p>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              未承認(提出済み): <span className="font-medium text-slate-900">{submittedCount}件</span> / 承認済み(締め前):{" "}
              <span className="font-medium text-slate-900">{approvedCount}件</span>
            </p>
            <form action={closeMonthSiteAttendanceAction}>
              <input type="hidden" name="monthStart" value={monthStart.toISOString()} />
              <input type="hidden" name="monthEnd" value={monthEnd.toISOString()} />
              <Button type="submit" variant="secondary" disabled={approvedCount === 0}>
                この月の承認済み分をまとめて締める({approvedCount}件)
              </Button>
            </form>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">日別出面一覧</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">日付</th>
                <th className="py-1 pr-2">元請</th>
                <th className="py-1 pr-2">現場</th>
                <th className="py-1 pr-2">氏名</th>
                <th className="py-1 pr-2">職種</th>
                <th className="py-1 pr-2">人工数</th>
                {isAdmin && <th className="py-1 pr-2">単価</th>}
                <th className="py-1 pr-2">状態</th>
                {isAdmin && <th className="py-1"></th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-1 pr-2">{r.targetDate.toLocaleDateString("ja-JP")}</td>
                  <td className="py-1 pr-2">{r.project.primeContractorName ?? "—"}</td>
                  <td className="py-1 pr-2">{r.project.name}</td>
                  <td className="py-1 pr-2">{r.workerName}</td>
                  <td className="py-1 pr-2">{r.jobType ?? "—"}</td>
                  <td className="py-1 pr-2">{r.manDays}</td>
                  {isAdmin && (
                    <td className="py-1 pr-2">
                      {r.status === "CLOSED" ? (
                        r.manDayUnitPrice != null ? `${r.manDayUnitPrice.toLocaleString("ja-JP")}円` : "—"
                      ) : (
                        <form action={updateSiteAttendancePricingAction} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={r.id} />
                          <Input
                            name="manDayUnitPrice"
                            type="number"
                            defaultValue={r.manDayUnitPrice ?? ""}
                            className="w-20"
                          />
                          <button type="submit" className="text-xs text-indigo-600 underline">
                            設定
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                  <td className="py-1 pr-2">{STATUS_LABEL[r.status]}</td>
                  {isAdmin && (
                    <td className="py-1 whitespace-nowrap">
                      {r.status === "SUBMITTED" && (
                        <form action={approveSiteAttendanceAction} className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="mr-2 text-xs text-emerald-600 underline">
                            承認
                          </button>
                        </form>
                      )}
                      {r.status === "SUBMITTED" && (
                        <Link href={`/site-attendance/${r.id}/reject`} className="mr-2 text-xs text-rose-600 underline">
                          差し戻し
                        </Link>
                      )}
                      {r.status === "CLOSED" && (
                        <Link href={`/site-attendance/${r.id}/reopen`} className="text-xs text-slate-600 underline">
                          締め解除
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="py-3 text-center text-slate-500">
                    該当する出面がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
