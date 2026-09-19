import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  updateDailyReportAction,
  deleteDailyReportAction,
  addDailyReportWorkerAction,
  deleteDailyReportWorkerAction,
} from "../actions";
import { Card, Input, Textarea, Select, Button, FieldLabel } from "@/components/ui";
import { PhotoUploadForm } from "./photos/PhotoUploadForm";
import { PhotoGallery } from "./photos/PhotoGallery";

const WORKER_TYPE_LABEL: Record<string, string> = {
  EMPLOYEE: "自社従業員",
  PARTNER: "協力会社",
  SUBCONTRACTOR: "外注",
  MANUAL: "手入力",
};

export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [report, employees] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        project: { include: { customer: true } },
        photos: { orderBy: { sortOrder: "asc" } },
        workers: {
          orderBy: { sortOrder: "asc" },
          include: {
            attendance: { select: { status: true } },
            siteAttendance: { select: { status: true } },
          },
        },
      },
    }),
    prisma.employee.findMany({ where: { companyId: user.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!report) notFound();

  const unclearItems: { field: string; note: string }[] = report.unclearItemsJson
    ? JSON.parse(report.unclearItemsJson)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {report.reportDate.toLocaleDateString("ja-JP")} 日報
          </h1>
          <p className="text-sm text-slate-500">
            取引先: {report.project.customer.name} / 工事名: {report.project.name}
          </p>
          {report.capturedAddress && (
            <p className="mt-0.5 text-xs text-slate-400">📍 {report.capturedAddress}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/daily-reports/${report.id}/print`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            印刷 / PDF
          </Link>
          <Link
            href={`/daily-reports/${report.id}/cost-ledger`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            原価集計表
          </Link>
        </div>
      </div>

      {unclearItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">確認が必要な項目({unclearItems.length}件)</p>
          <p className="mt-1 text-sm text-amber-700">
            音声から自動認識できなかった項目です。断定せず空欄にしています。内容を確認し、下のフォームで入力・保存してください。
          </p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
            {unclearItems.map((item) => (
              <li key={item.field}>
                {item.field}: {item.note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.rawVoiceInput && (
        <Card className="bg-slate-50">
          <p className="text-xs font-medium text-slate-500">音声認識結果(原文)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.rawVoiceInput}</p>
        </Card>
      )}

      <Card className="max-w-xl">
        <h2 className="mb-3 font-semibold text-slate-900">写真(施工前・中・後)</h2>
        <div className="flex flex-col gap-4">
          <PhotoGallery photos={report.photos} />
          <PhotoUploadForm dailyReportId={report.id} existingPhotoCount={report.photos.length} />
        </div>
      </Card>

      <Card className="max-w-xl">
        <form action={updateDailyReportAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={report.id} />

          <FieldLabel label="天候">
            <Input name="weather" defaultValue={report.weather ?? ""} />
          </FieldLabel>
          <FieldLabel label="作業員数">
            <Input name="workerCount" type="number" defaultValue={report.workerCount ?? ""} />
          </FieldLabel>
          <FieldLabel label="職長">
            <Input name="foremanName" defaultValue={report.foremanName ?? ""} />
          </FieldLabel>
          <FieldLabel label="作業内容">
            <Textarea name="workContent" rows={3} defaultValue={report.workContent ?? ""} />
          </FieldLabel>
          <FieldLabel label="使用機械">
            <Input name="machinery" defaultValue={report.machinery ?? ""} />
          </FieldLabel>
          <FieldLabel label="使用車両">
            <Input name="vehicles" defaultValue={report.vehicles ?? ""} />
          </FieldLabel>
          <FieldLabel label="使用材料">
            <Input name="materials" defaultValue={report.materials ?? ""} />
          </FieldLabel>
          <FieldLabel label="協力会社">
            <Input name="subcontractors" defaultValue={report.subcontractors ?? ""} />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-4">
            <FieldLabel label="開始時間">
              <Input name="startTime" type="time" defaultValue={report.startTime ?? ""} />
            </FieldLabel>
            <FieldLabel label="終了時間">
              <Input name="endTime" type="time" defaultValue={report.endTime ?? ""} />
            </FieldLabel>
            <FieldLabel label="休憩時間(分)">
              <Input name="breakMinutes" type="number" defaultValue={report.breakMinutes ?? ""} />
            </FieldLabel>
            <FieldLabel label="残業時間(分)">
              <Input name="overtimeMinutes" type="number" defaultValue={report.overtimeMinutes ?? ""} />
            </FieldLabel>
          </div>
          <FieldLabel label="出来高・数量">
            <Input name="quantityWorked" defaultValue={report.quantityWorked ?? ""} />
          </FieldLabel>
          <FieldLabel label="安全確認">
            <Input name="safetyNotes" defaultValue={report.safetyNotes ?? ""} />
          </FieldLabel>
          <FieldLabel label="危険予知">
            <Textarea name="dangerPrediction" rows={2} defaultValue={report.dangerPrediction ?? ""} />
          </FieldLabel>
          <FieldLabel label="問題点">
            <Textarea name="issues" rows={2} defaultValue={report.issues ?? ""} />
          </FieldLabel>
          <FieldLabel label="翌日の予定">
            <Textarea name="nextDayPlan" rows={2} defaultValue={report.nextDayPlan ?? ""} />
          </FieldLabel>
          <FieldLabel label="備考">
            <Textarea name="remarks" rows={2} defaultValue={report.remarks ?? ""} />
          </FieldLabel>
          <FieldLabel label="現場住所(GPS取得値、手動修正可)">
            <Input name="capturedAddress" defaultValue={report.capturedAddress ?? ""} />
          </FieldLabel>

          <Button type="submit">確認して保存する</Button>
        </form>
      </Card>

      <Card className="max-w-xl">
        <h2 className="mb-1 font-semibold text-slate-900">作業員(勤怠・出面)</h2>
        <p className="mb-3 text-xs text-slate-500">
          ここで追加した作業員は、自動で勤怠(自社従業員のみ)・出面へ反映されます。反映済みで承認・締め済みのものは、日報を直しても自動では上書きされません。
        </p>
        <div className="flex flex-col gap-2">
          {report.workers.map((w) => (
            <div key={w.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {w.workerName}
                  {w.isForeman && <span className="ml-1 text-xs text-indigo-600">(職長)</span>}
                  <span className="ml-2 text-xs text-slate-400">{WORKER_TYPE_LABEL[w.workerType]}</span>
                </p>
                <form action={deleteDailyReportWorkerAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="dailyReportId" value={report.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {w.role && <span>職種: {w.role}</span>}
                {(w.startTime || w.endTime) && (
                  <span>
                    {w.startTime ?? "-"}〜{w.endTime ?? "-"}
                  </span>
                )}
                {w.manDays != null && <span>{w.manDays}人工</span>}
                {w.workDescription && <span>作業内容: {w.workDescription}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  勤怠: {w.attendance ? w.attendance.status : "未反映"}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                  出面: {w.siteAttendance ? w.siteAttendance.status : "未反映"}
                </span>
              </div>
            </div>
          ))}
          {report.workers.length === 0 && <p className="text-sm text-slate-500">まだ作業員が追加されていません。</p>}
        </div>

        <form action={addDailyReportWorkerAction} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
          <input type="hidden" name="dailyReportId" value={report.id} />
          <div className="grid grid-cols-2 gap-2">
            <FieldLabel label="種別">
              <Select name="workerType" defaultValue="EMPLOYEE">
                <option value="EMPLOYEE">自社従業員</option>
                <option value="PARTNER">協力会社</option>
                <option value="SUBCONTRACTOR">外注</option>
                <option value="MANUAL">手入力</option>
              </Select>
            </FieldLabel>
            <FieldLabel label="自社従業員(種別が自社の場合)">
              <Select name="employeeId" defaultValue="">
                <option value="">選択してください</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </div>
          <FieldLabel label="氏名(協力会社・外注・手入力の場合)">
            <Input name="workerName" placeholder="氏名" />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <FieldLabel label="職種">
              <Input name="role" />
            </FieldLabel>
            <FieldLabel label="人工数">
              <Input name="manDays" type="number" step="0.25" placeholder="1" />
            </FieldLabel>
            <FieldLabel label="開始時間">
              <Input name="startTime" type="time" defaultValue={report.startTime ?? ""} />
            </FieldLabel>
            <FieldLabel label="終了時間">
              <Input name="endTime" type="time" defaultValue={report.endTime ?? ""} />
            </FieldLabel>
            <FieldLabel label="休憩時間(分)">
              <Input name="breakMinutes" type="number" defaultValue={report.breakMinutes ?? 0} />
            </FieldLabel>
          </div>
          <FieldLabel label="作業内容">
            <Input name="workDescription" />
          </FieldLabel>
          <div className="flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="isForeman" /> 職長
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="isBillable" defaultChecked /> 請求対象
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="reflectToAttendance" defaultChecked /> 勤怠へ反映
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="reflectToSiteAttendance" defaultChecked /> 出面へ反映
            </label>
          </div>
          <Button type="submit" variant="secondary" className="w-fit">
            + 作業員を追加
          </Button>
        </form>
      </Card>

      <form action={deleteDailyReportAction} className="max-w-xl">
        <input type="hidden" name="id" value={report.id} />
        <Button type="submit" variant="danger">
          この日報を削除する
        </Button>
      </form>
    </div>
  );
}
