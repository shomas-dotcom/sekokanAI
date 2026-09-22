import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { canManageProjectTimesheet } from "@/lib/timesheet/permissions";
import { formatJstTime } from "@/lib/timesheet/time";
import { approveSiteAttendanceAction } from "../../actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  APPROVED: "承認済み",
  REJECTED: "差し戻し",
  CLOSED: "締め済み",
};

/**
 * 出面の承認画面。出面単体ではなく、元になった日報の内容(作業内容・車両重機・写真・
 * 備考)と、同じ人の勤怠もあわせて1画面で確認できるようにする(REQUIREMENTS.md/
 * 依頼書フェーズ7「承認画面」の要件どおり、判断材料をまとめて見せる)。
 */
export default async function SiteAttendanceReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const record = await prisma.siteAttendance.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { select: { name: true, primeContractorName: true } },
      dailyReportWorker: { include: { attendance: true } },
      sourceDailyReport: {
        include: { photos: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!record) notFound();
  if (!(await canManageProjectTimesheet(user, record.projectId))) redirect("/site-attendance");

  const report = record.sourceDailyReport;
  const attendance = record.dailyReportWorker?.attendance ?? null;

  const expenses = await prisma.siteExpenseEntry.findMany({
    where: { companyId: user.companyId, projectId: record.projectId, targetDate: record.targetDate },
  });

  const categoryLabel: Record<string, string> = {
    VEHICLE: "車両",
    MACHINERY: "重機",
    MATERIAL: "材料",
    TRANSPORT: "回送",
    TRAVEL_EXPENSE: "交通費",
    OTHER: "その他",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">出面の承認</h1>
        <p className="mt-1 text-sm text-slate-500">
          {record.workerName} / {record.project.primeContractorName ?? "元請未設定"} / {record.project.name} /{" "}
          {record.targetDate.toLocaleDateString("ja-JP")}
        </p>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">出面内容</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">職種</dt>
            <dd className="text-slate-800">{record.jobType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">開始〜終了</dt>
            <dd className="text-slate-800">
              {formatJstTime(record.startTime) || "—"}〜{formatJstTime(record.endTime) || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">人工数</dt>
            <dd className="text-slate-800">{record.manDays}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">請求対象</dt>
            <dd className="text-slate-800">{record.isBillable ? "はい" : "いいえ"}</dd>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-xs text-slate-500">作業内容</dt>
            <dd className="whitespace-pre-wrap text-slate-800">{record.workContent ?? "—"}</dd>
          </div>
          {record.remarks && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-slate-500">備考</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{record.remarks}</dd>
            </div>
          )}
        </dl>
      </Card>

      {attendance && (
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">勤怠内容(同じ人・同じ日)</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">出勤〜退勤</dt>
              <dd className="text-slate-800">
                {formatJstTime(attendance.clockInTime) || "—"}〜{formatJstTime(attendance.clockOutTime) || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">実働</dt>
              <dd className="text-slate-800">
                {attendance.actualWorkMinutes != null ? `${(attendance.actualWorkMinutes / 60).toFixed(1)}h` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">残業</dt>
              <dd className="text-slate-800">
                {attendance.overtimeMinutes != null ? `${(attendance.overtimeMinutes / 60).toFixed(1)}h` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">勤怠の状態</dt>
              <dd className="text-slate-800">{STATUS_LABEL[attendance.status]}</dd>
            </div>
          </dl>
        </Card>
      )}

      {report && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">日報内容(元になった日報)</h2>
            <Link href={`/daily-reports/${report.id}`} className="text-xs font-medium text-orange-700 underline">
              日報を開く
            </Link>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">天候</dt>
              <dd className="text-slate-800">{report.weather ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">作業員数</dt>
              <dd className="text-slate-800">{report.workerCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">職長</dt>
              <dd className="text-slate-800">{report.foremanName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">使用機械</dt>
              <dd className="text-slate-800">{report.machinery ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">使用車両</dt>
              <dd className="text-slate-800">{report.vehicles ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">使用材料</dt>
              <dd className="text-slate-800">{report.materials ?? "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-slate-500">作業内容(日報全体)</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{report.workContent ?? "—"}</dd>
            </div>
            {report.safetyNotes && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-slate-500">安全確認</dt>
                <dd className="whitespace-pre-wrap text-slate-800">{report.safetyNotes}</dd>
              </div>
            )}
          </dl>

          {report.photos.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-slate-500">写真({report.photos.length}枚)</p>
              <div className="flex flex-wrap gap-2">
                {report.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={`/daily-reports/${report.id}/photos/${p.id}`}
                    alt="現場写真"
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {expenses.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">車両・重機・経費(同じ現場・同じ日)</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>
                  {categoryLabel[e.category] ?? e.category} / {e.name} / {e.quantity}
                </span>
                <span>{e.amount != null ? `${e.amount.toLocaleString("ja-JP")}円` : "—"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            現在の状態: <span className="font-medium text-slate-900">{STATUS_LABEL[record.status]}</span>
          </p>
          {record.status === "SUBMITTED" && (
            <div className="flex gap-2">
              <form action={approveSiteAttendanceAction}>
                <input type="hidden" name="id" value={record.id} />
                <Button type="submit">承認する</Button>
              </form>
              <Link href={`/site-attendance/${record.id}/reject`}>
                <Button type="button" variant="danger">
                  差し戻す
                </Button>
              </Link>
            </div>
          )}
        </div>
        {record.status === "REJECTED" && record.rejectionReason && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            差し戻し理由: {record.rejectionReason}
          </p>
        )}
      </Card>
    </div>
  );
}
