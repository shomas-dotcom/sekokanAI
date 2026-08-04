import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Badge } from "@/components/ui";

export default async function DailyReportsPage() {
  const user = await requireUser();
  const reports = await prisma.dailyReport.findMany({
    where: { companyId: user.companyId },
    include: { project: true },
    orderBy: { reportDate: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">日報</h1>
        <Link href="/daily-reports/new">
          <Button>+ 日報を作成</Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ日報がありません。現場でマイクボタンから話すだけで作成できます。
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
                    {r.reportDate.toLocaleDateString("ja-JP")} / {r.project.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.weather ?? "天候未確認"} ・ 作業員 {r.workerCount ?? "?"} 名
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
