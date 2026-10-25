import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Select } from "@/components/ui";
import {
  aggregateCosts,
  jstDateKey,
  jstMonthKey,
  sumAll,
  type CostTotals,
  type LaborCostRow,
  type MachineCostRow,
} from "@/lib/dailyReport/costAggregate";

// 現場別の原価管理(管理者専用)。日報から作られた出面(労務費)と、使用機械の経費(機械費)を
// 現場別・日別・月別・作業員別に見る。数字の元は既存の出面・経費で、ここで新しく入力はしない。
// 日報を直したり消したりすると、承認前の分はここにもそのまま反映される。

function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function Missing({ totals }: { totals: CostTotals }) {
  const count = totals.laborMissing + totals.machineMissing;
  if (count === 0) return null;
  return <span className="block text-xs text-amber-700">⚠ 単価未登録 {count}件(含まず)</span>;
}

function CostRow({ label, totals, extra }: { label: string; totals: CostTotals; extra?: React.ReactNode }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="py-1.5 pr-2">{label}</td>
      <td className="py-1.5 pr-2 tabular-nums">{totals.manDays}</td>
      <td className="py-1.5 pr-2 tabular-nums">{yen(totals.labor)}</td>
      <td className="py-1.5 pr-2 tabular-nums">{yen(totals.machine)}</td>
      <td className="py-1.5 pr-2 font-semibold tabular-nums">
        {yen(totals.total)}
        <Missing totals={totals} />
      </td>
      {extra}
    </tr>
  );
}

const HEAD = ["人工数", "労務費", "機械費", "合計"];

export default async function CostManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; project?: string }>;
}) {
  const { month: monthParam, project: projectParam } = await searchParams;
  const user = await requireAdmin();
  const companyId = user.companyId;

  const now = new Date();
  const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  const y = match ? Number(match[1]) : nowJst.getUTCFullYear();
  const parsedMonth = match ? Number(match[2]) : Number.NaN;
  const m = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : nowJst.getUTCMonth() + 1;
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  const projectId = projects.some((p) => p.id === projectParam) ? (projectParam as string) : "";
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  // 累計(その月の終わりまで)をまとめて取り、当月・日別・月別はこの中から切り出す。
  const [laborRecords, expenseRecords] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { companyId, targetDate: { lt: monthEnd }, ...(projectId ? { projectId } : {}) },
      select: { projectId: true, targetDate: true, workerName: true, manDays: true, isCostTarget: true, laborCostUnitPrice: true },
    }),
    prisma.siteExpenseEntry.findMany({
      where: {
        companyId,
        category: { in: ["MACHINERY", "VEHICLE"] },
        targetDate: { lt: monthEnd },
        ...(projectId ? { projectId } : {}),
      },
      select: { projectId: true, targetDate: true, amount: true, isCostTarget: true },
    }),
  ]);

  const inMonth = (d: Date) => d >= monthStart;
  const labor = (keyOf: (r: (typeof laborRecords)[number]) => string, filter: (d: Date) => boolean): LaborCostRow[] =>
    laborRecords.filter((r) => filter(r.targetDate)).map((r) => ({ key: keyOf(r), manDays: r.manDays, isCostTarget: r.isCostTarget, laborCostUnitPrice: r.laborCostUnitPrice }));
  const machines = (keyOf: (r: (typeof expenseRecords)[number]) => string, filter: (d: Date) => boolean): MachineCostRow[] =>
    expenseRecords.filter((r) => filter(r.targetDate)).map((r) => ({ key: keyOf(r), amount: r.amount, isCostTarget: r.isCostTarget }));

  const byProjectMonth = aggregateCosts(labor((r) => r.projectId, inMonth), machines((r) => r.projectId, inMonth));
  const byProjectCumulative = aggregateCosts(
    labor((r) => r.projectId, () => true),
    machines((r) => r.projectId, () => true)
  );
  const byDate = aggregateCosts(labor((r) => jstDateKey(r.targetDate), inMonth), machines((r) => jstDateKey(r.targetDate), inMonth));
  const byWorker = aggregateCosts(labor((r) => r.workerName, inMonth), []);
  // 月別: 選んだ月までの直近12か月
  const twelveMonthsAgo = new Date(Date.UTC(y, m - 1 - 11, 1, -9, 0));
  const byMonth = aggregateCosts(
    labor((r) => jstMonthKey(r.targetDate), (d) => d >= twelveMonthsAgo),
    machines((r) => jstMonthKey(r.targetDate), (d) => d >= twelveMonthsAgo)
  );

  const projectKeys = [...new Set([...byProjectCumulative.keys()])].sort((a, b) =>
    (projectName.get(a) ?? "").localeCompare(projectName.get(b) ?? "", "ja")
  );
  const monthTotal = sumAll(byProjectMonth.values());
  const cumulativeTotal = sumAll(byProjectCumulative.values());
  const sortedDates = [...byDate.keys()].sort();
  const sortedMonths = [...byMonth.keys()].sort().reverse();
  const sortedWorkers = [...byWorker.entries()].sort((a, b) => b[1].manDays - a[1].manDays);

  const link = (patch: { month?: string; project?: string }) => {
    const query = new URLSearchParams({ month: patch.month ?? monthKey });
    const p = patch.project ?? projectId;
    if (p) query.set("project", p);
    return `/cost-management?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">原価管理({y}年{m}月)</h1>
        <p className="mt-1 text-sm text-slate-500">
          日報から作られた出面(労務費)と、使用機械の経費(機械費)を集計しています。管理者だけが見られます。
          承認前のものも含み、日報を直すとここも変わります。単価が未登録の行は金額に含めず、件数でお知らせします。
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2 text-sm">
            <Link href={link({ month: prevMonth })} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              前月
            </Link>
            <Link href={link({ month: nextMonth })} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
              翌月
            </Link>
          </div>
          <form className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="month" value={monthKey} />
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              現場で絞り込む
              <Select name="project" defaultValue={projectId} className="w-56 text-base!">
                <option value="">すべての現場</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <button type="submit" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              絞り込む
            </button>
          </form>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-slate-500">今月の原価(労務費+機械費)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{yen(monthTotal.total)}</p>
          <p className="mt-1 text-xs text-slate-500">
            労務費 {yen(monthTotal.labor)} / 機械費 {yen(monthTotal.machine)} / {monthTotal.manDays}人工
          </p>
          <Missing totals={monthTotal} />
        </Card>
        <Card>
          <p className="text-sm text-slate-500">累計の原価({y}年{m}月末まで)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{yen(cumulativeTotal.total)}</p>
          <p className="mt-1 text-xs text-slate-500">
            労務費 {yen(cumulativeTotal.labor)} / 機械費 {yen(cumulativeTotal.machine)} / {cumulativeTotal.manDays}人工
          </p>
          <Missing totals={cumulativeTotal} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">現場別(今月と累計)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">現場</th>
                {HEAD.map((h) => (
                  <th key={h} className="py-1 pr-2">
                    今月の{h}
                  </th>
                ))}
                <th className="py-1 pr-2">累計の合計</th>
              </tr>
            </thead>
            <tbody>
              {projectKeys.map((key) => (
                <CostRow
                  key={key}
                  label={projectName.get(key) ?? "(不明な現場)"}
                  totals={byProjectMonth.get(key) ?? sumAll([])}
                  extra={
                    <td className="py-1.5 pr-2 tabular-nums">
                      {yen(byProjectCumulative.get(key)?.total ?? 0)}
                      {byProjectCumulative.get(key) && <Missing totals={byProjectCumulative.get(key) as CostTotals} />}
                    </td>
                  }
                />
              ))}
              {projectKeys.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-500">
                    データがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">日別(今月)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">日付</th>
                {HEAD.map((h) => (
                  <th key={h} className="py-1 pr-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDates.map((key) => (
                <CostRow key={key} label={key.replaceAll("-", "/")} totals={byDate.get(key) as CostTotals} />
              ))}
              {sortedDates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-500">
                    今月のデータがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">作業員別の人工数(今月)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">作業員</th>
                <th className="py-1 pr-2">人工数</th>
                <th className="py-1 pr-2">労務費</th>
              </tr>
            </thead>
            <tbody>
              {sortedWorkers.map(([name, totals]) => (
                <tr key={name} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-2">{name}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{totals.manDays}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {yen(totals.labor)}
                    <Missing totals={totals} />
                  </td>
                </tr>
              ))}
              {sortedWorkers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-slate-500">
                    今月のデータがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">月別(直近12か月)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">月</th>
                {HEAD.map((h) => (
                  <th key={h} className="py-1 pr-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMonths.map((key) => (
                <CostRow key={key} label={key.replace("-", "年") + "月"} totals={byMonth.get(key) as CostTotals} />
              ))}
              {sortedMonths.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-500">
                    データがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-slate-500">
        単価は <Link href="/settings/daily-report-masters?tab=labor" className="underline">日報マスタ管理</Link> で登録します。
        出面ごとの原価単価の手直しは <Link href="/site-attendance" className="underline">出面・常用集計</Link> でできます。
      </p>
    </div>
  );
}
