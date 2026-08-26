import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/PrintButton";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function row(label: string, value: string | number | null | undefined) {
  return (
    <div className="flex border-b border-zinc-200 py-1 text-sm">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-900">{value || value === 0 ? value : "—"}</span>
    </div>
  );
}

export default async function DailyReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) notFound();

  const weekday = WEEKDAY_JA[report.reportDate.getDay()];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 15mm 15mm; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold text-zinc-900">作業日報</h1>

      <div className="mt-4 flex justify-between text-sm text-zinc-800">
        <div>
          <p>
            {report.reportDate.toLocaleDateString("ja-JP")}({weekday})
          </p>
          <p className="mt-1 font-semibold">取引先: {report.project.customer.name}</p>
          <p>工事名: {report.project.name}</p>
        </div>
        <div className="text-right text-zinc-600">
          <p>{user.company.name}</p>
          <p>作成者: {user.name}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-8">
        <div>
          {row("天候", report.weather)}
          {row("現場住所", report.capturedAddress ?? report.project.siteAddress)}
          {row("作業員数", report.workerCount ? `${report.workerCount}名` : null)}
          {row("職長", report.foremanName)}
          {row("開始時間", report.startTime)}
          {row("終了時間", report.endTime)}
          {row("休憩時間", report.breakMinutes ? `${report.breakMinutes}分` : null)}
          {row("残業時間", report.overtimeMinutes ? `${report.overtimeMinutes}分` : null)}
        </div>
        <div>
          {row("使用機械", report.machinery)}
          {row("使用車両", report.vehicles)}
          {row("使用材料", report.materials)}
          {row("協力会社", report.subcontractors)}
          {row("出来高・数量", report.quantityWorked)}
          {row("安全確認", report.safetyNotes)}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500">作業内容</p>
        <p className="mt-1 min-h-[3em] whitespace-pre-wrap rounded border border-zinc-200 p-2 text-sm text-zinc-900">
          {report.workContent || "—"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-8">
        <div>
          <p className="text-xs font-medium text-zinc-500">危険予知</p>
          <p className="mt-1 min-h-[2em] whitespace-pre-wrap text-sm text-zinc-900">
            {report.dangerPrediction || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">翌日の予定</p>
          <p className="mt-1 min-h-[2em] whitespace-pre-wrap text-sm text-zinc-900">
            {report.nextDayPlan || "—"}
          </p>
        </div>
      </div>

      {report.issues && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500">問題点</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">{report.issues}</p>
        </div>
      )}

      {report.remarks && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500">備考</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">{report.remarks}</p>
        </div>
      )}

      {report.photos.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-zinc-500">現場写真</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {report.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={`/daily-reports/${report.id}/photos/${photo.id}`}
                alt={photo.caption ?? "現場写真"}
                className="aspect-square w-full rounded border border-zinc-200 object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
