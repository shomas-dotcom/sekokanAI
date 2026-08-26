import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Badge, Select } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; month?: string; worker?: string }>;
}) {
  const user = await requireUser();
  const { projectId, month, worker } = await searchParams;

  const where: Prisma.DailyReportWhereInput = { companyId: user.companyId };
  if (projectId) where.projectId = projectId;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      where.reportDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
    }
  }
  if (worker) {
    where.OR = [
      { foremanName: { contains: worker } },
      { laborEntries: { some: { workerName: { contains: worker } } } },
    ];
  }

  const [reports, projects] = await Promise.all([
    prisma.dailyReport.findMany({
      where,
      include: { project: { include: { customer: true } } },
      orderBy: { reportDate: "desc" },
    }),
    prisma.project.findMany({
      where: { companyId: user.companyId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">日報</h1>
        <Link href="/daily-reports/new">
          <Button>+ 日報を作成</Button>
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          案件・取引先
          <Select name="projectId" defaultValue={projectId ?? ""} className="w-56">
            <option value="">すべて</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.customer.name} / {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          月
          <input
            type="month"
            name="month"
            defaultValue={month ?? ""}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          職長・作業員名
          <input
            type="text"
            name="worker"
            defaultValue={worker ?? ""}
            placeholder="例: 田中"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit" variant="secondary">
          絞り込み
        </Button>
        {(projectId || month || worker) && (
          <Link href="/daily-reports" className="text-xs text-slate-500 underline">
            条件をクリア
          </Link>
        )}
      </form>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          該当する日報がありません。現場でマイクボタンから話すだけで作成できます。
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => {
            const unclearCount = r.unclearItemsJson ? JSON.parse(r.unclearItemsJson).length : 0;
            return (
              <Link
                key={r.id}
                href={`/daily-reports/${r.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {r.reportDate.toLocaleDateString("ja-JP")} / {r.project.customer.name} / {r.project.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.weather ?? "天候未確認"} ・ 作業員 {r.workerCount ?? "?"} 名
                    {r.foremanName ? ` ・ 職長 ${r.foremanName}` : ""}
                  </p>
                </div>
                {unclearCount > 0 && <Badge className="bg-amber-50 text-amber-700">要確認 {unclearCount}件</Badge>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
