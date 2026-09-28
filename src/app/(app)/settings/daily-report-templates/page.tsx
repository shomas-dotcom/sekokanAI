import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui";
import { NewDailyReportTemplateForm } from "./NewDailyReportTemplateForm";

export default async function DailyReportTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const admin = await requireAdmin();
  const templates = await prisma.dailyReportTemplate.findMany({
    where: { companyId: admin.companyId },
    orderBy: { createdAt: "asc" },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">日報の雛形</h1>
        <p className="mt-1 text-sm text-slate-500">
          元請などへ提出しているExcel日報を、御社が普段使っている書式そのままで出力できるようにする機能です。
          登録しない場合は、これまで通り印刷/PDF保存だけが使えます。
        </p>
      </div>

      {saved === "1" && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">保存しました。</p>
      )}

      <Card>
        <h2 className="font-semibold text-slate-900">登録済みの雛形</h2>
        {templates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ登録されていません。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {templates.map((t) => {
              const latest = t.versions[0];
              const isMapped = latest && latest.workerMaxRows > 0;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/settings/daily-report-templates/${t.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {t.name}
                    </Link>
                    <div className="mt-1 flex gap-2">
                      <Badge>v{latest?.versionNumber ?? "-"}</Badge>
                      {!t.isActive && <Badge className="bg-slate-200 text-slate-500">無効</Badge>}
                      {latest && !isMapped && (
                        <Badge className="bg-amber-100 text-amber-700">位置合わせ未完了(このままでは使えません)</Badge>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/settings/daily-report-templates/${t.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    詳しく見る
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">雛形を登録</h2>
        <p className="mt-1 text-sm text-slate-500">
          元請などへ提出しているExcel日報のファイル(.xlsx)をそのまま登録してください。登録後、どのセルに何を書き込むかを画面で指定します。
        </p>
        <div className="mt-3">
          <NewDailyReportTemplateForm />
        </div>
      </Card>
    </div>
  );
}
