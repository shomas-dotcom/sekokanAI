import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadQuickMasters, parseMeasures } from "@/lib/dailyReport/masters";
import { derivedWorkerName, type QuickState } from "@/lib/dailyReport/quickInput";
import { QuickReportEditor } from "../../quick/QuickReportEditor";

// 前回までの日報を、かんたん入力の画面で直す(日付も変えられる)。
// かんたん入力を使わずに作られた古い日報も開ける。文章の項目は、選び直すまで消さない。
export default async function EditDailyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [report, masters] = await Promise.all([
    prisma.dailyReport.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        project: { include: { customer: true } },
        workEntries: { orderBy: { sortOrder: "asc" } },
        machineUsages: { orderBy: { sortOrder: "asc" } },
        kyEntries: { orderBy: { sortOrder: "asc" } },
        workers: { orderBy: { sortOrder: "asc" } },
      },
    }),
    loadQuickMasters(user),
  ]);
  if (!report) notFound();

  // 現場責任者は担当現場の日報だけ直せる(詳細画面と同じ決まり)。
  if (user.role === "SITE_MANAGER") {
    const supervises = await prisma.projectSupervisor.findFirst({
      where: { projectId: report.projectId, userId: user.id },
    });
    if (!supervises) notFound();
  }

  const baseMinutes = (days: number) => Math.round(days * masters.manDayBaseMinutes);

  const state: QuickState = {
    works: report.workEntries.map((w) => ({
      key: w.id,
      workItemId: w.workItemId,
      label: w.label,
      quantity: w.quantity,
      unit: w.unit,
      workMinutes: w.workMinutes,
      remarks: w.remarks,
    })),
    machines: report.machineUsages.map((m) => ({
      key: m.id,
      id: m.id,
      machineId: m.machineId,
      name: m.name,
      ownership: m.ownership,
      quantity: m.quantity,
      usageValue: m.usageValue,
    })),
    labor: report.workers.map((w) => {
      const manDays = w.manDays ?? 1;
      const base = {
        workerName: w.workerName,
        category: w.laborCategory,
        affiliation: w.affiliation,
        headcount: w.headcount,
      };
      // 氏名を入れていない外注・応援等の行は、保存のときに作った表示名を氏名欄に戻さない(人数の入力が隠れるため)。
      const typedName = !w.employeeId && w.workerName === derivedWorkerName({ ...base, workerName: "" }) ? "" : w.workerName;
      // 人工数から自動で入れた作業時間は、人が入力した時間として見せない。
      const autoMinutes = w.workMinutes != null && w.workMinutes === baseMinutes(manDays);
      return {
        key: w.id,
        id: w.id,
        category: w.laborCategory,
        employeeId: w.employeeId,
        workerName: typedName,
        affiliation: w.affiliation,
        headcount: w.headcount,
        manDays,
        workMinutes: autoMinutes ? null : w.workMinutes,
        workDescription: w.workDescription,
      };
    }),
    ky: report.kyEntries.map((k) => ({
      key: k.id,
      hazardId: k.hazardId,
      label: k.label,
      measures: parseMeasures(k.measuresJson),
    })),
  };

  const isStructured = report.workEntries.length + report.machineUsages.length + report.kyEntries.length > 0;
  const hasLegacyText = Boolean(report.workContent || report.machinery || report.vehicles || report.dangerPrediction);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/daily-reports/${report.id}`} className="text-sm text-slate-500 underline">
          ← 日報の詳細にもどる
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">日報を修正</h1>
      </div>
      <QuickReportEditor
        mode="edit"
        reportId={report.id}
        projects={[]}
        lockedProjectLabel={`${report.project.customer.name} / ${report.project.name}`}
        masters={masters}
        legacyNotice={!isStructured && hasLegacyText}
        initial={{
          projectId: report.projectId,
          reportDate: report.reportDate.toISOString().slice(0, 10),
          weather: report.weather ?? "",
          // かんたん入力を使った日報は、音声・メモだけを見せる(作業内容の文章は選択内容から作られるため)。
          memo: isStructured ? (report.rawVoiceInput ?? "") : (report.rawVoiceInput ?? report.workContent ?? ""),
          nextDayPlan: report.nextDayPlan ?? "",
          state,
        }}
      />
    </div>
  );
}
