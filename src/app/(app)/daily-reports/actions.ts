"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { draftDailyReportFromText } from "@/lib/ai";

export type DailyReportFormState = { error?: string } | undefined;

export async function createDailyReportAction(
  _prevState: DailyReportFormState,
  formData: FormData
): Promise<DailyReportFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const reportDateStr = String(formData.get("reportDate") ?? "");
  const rawVoiceInput = String(formData.get("rawVoiceInput") ?? "").trim();

  if (!projectId) return { error: "案件を選択してください。" };
  if (!reportDateStr) return { error: "日付を入力してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  const draft = rawVoiceInput ? await draftDailyReportFromText(rawVoiceInput) : null;

  const report = await prisma.dailyReport.create({
    data: {
      companyId: user.companyId,
      projectId,
      reportDate: new Date(reportDateStr),
      weather: draft?.weather ?? null,
      workerCount: draft?.workerCount ?? null,
      workContent: draft?.workContent ?? null,
      machinery: draft?.machinery ?? null,
      quantityWorked: draft?.quantityWorked ?? null,
      safetyNotes: draft?.safetyNotes ?? null,
      rawVoiceInput: rawVoiceInput || null,
      unclearItemsJson: draft ? JSON.stringify(draft.unclearItems) : null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.create",
    targetType: "DailyReport",
    targetId: report.id,
  });

  revalidatePath("/daily-reports");
  redirect(`/daily-reports/${report.id}`);
}

export async function updateDailyReportAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!report) redirect("/daily-reports");

  const workerCountStr = String(formData.get("workerCount") ?? "").trim();

  await prisma.dailyReport.update({
    where: { id },
    data: {
      weather: String(formData.get("weather") ?? "").trim() || null,
      workerCount: workerCountStr ? Number(workerCountStr) : null,
      workContent: String(formData.get("workContent") ?? "").trim() || null,
      machinery: String(formData.get("machinery") ?? "").trim() || null,
      quantityWorked: String(formData.get("quantityWorked") ?? "").trim() || null,
      safetyNotes: String(formData.get("safetyNotes") ?? "").trim() || null,
      issues: String(formData.get("issues") ?? "").trim() || null,
      nextDayPlan: String(formData.get("nextDayPlan") ?? "").trim() || null,
      // 人間が内容を確認・保存した時点で確認候補は解消したとみなす
      unclearItemsJson: null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.update",
    targetType: "DailyReport",
    targetId: id,
  });

  revalidatePath(`/daily-reports/${id}`);
  redirect(`/daily-reports/${id}`);
}

export async function deleteDailyReportAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.dailyReport.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.delete",
    targetType: "DailyReport",
    targetId: id,
  });

  revalidatePath("/daily-reports");
  redirect("/daily-reports");
}
