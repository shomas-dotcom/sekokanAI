import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDailyReportAction, deleteDailyReportAction } from "../actions";
import { Card, Input, Textarea, Button, FieldLabel } from "@/components/ui";

export default async function DailyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { include: { customer: true } } },
  });
  if (!report) notFound();

  const unclearItems: { field: string; note: string }[] = report.unclearItemsJson
    ? JSON.parse(report.unclearItemsJson)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {report.reportDate.toLocaleDateString("ja-JP")} 日報
        </h1>
        <p className="text-sm text-slate-500">
          {report.project.customer.name} / {report.project.name}
        </p>
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
        <form action={updateDailyReportAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={report.id} />

          <FieldLabel label="天候">
            <Input name="weather" defaultValue={report.weather ?? ""} />
          </FieldLabel>
          <FieldLabel label="作業員数">
            <Input name="workerCount" type="number" defaultValue={report.workerCount ?? ""} />
          </FieldLabel>
          <FieldLabel label="作業内容">
            <Textarea name="workContent" rows={3} defaultValue={report.workContent ?? ""} />
          </FieldLabel>
          <FieldLabel label="使用機械">
            <Input name="machinery" defaultValue={report.machinery ?? ""} />
          </FieldLabel>
          <FieldLabel label="出来高・数量">
            <Input name="quantityWorked" defaultValue={report.quantityWorked ?? ""} />
          </FieldLabel>
          <FieldLabel label="安全事項">
            <Input name="safetyNotes" defaultValue={report.safetyNotes ?? ""} />
          </FieldLabel>
          <FieldLabel label="問題点">
            <Textarea name="issues" rows={2} defaultValue={report.issues ?? ""} />
          </FieldLabel>
          <FieldLabel label="翌日の予定">
            <Textarea name="nextDayPlan" rows={2} defaultValue={report.nextDayPlan ?? ""} />
          </FieldLabel>

          <Button type="submit">確認して保存する</Button>
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
