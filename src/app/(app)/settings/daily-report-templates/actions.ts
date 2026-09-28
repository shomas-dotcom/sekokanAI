"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateXlsxTemplateFile } from "@/lib/fileValidation";
import { listWorkbookSheets } from "@/lib/xlsx/sheetPreview";
import {
  DAILY_REPORT_TEMPLATE_FIELD_KEYS,
  DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS,
  isValidCellAddress,
  isValidColumnLetter,
} from "@/lib/xlsx/dailyReportTemplateFields";

export type DailyReportTemplateFormState = { error?: string } | undefined;

async function fileToBuffer(file: File): Promise<Buffer<ArrayBuffer>> {
  return Buffer.from(await file.arrayBuffer());
}

/** 新しい雛形(1件目のバージョン)を登録する。この時点ではマッピング未設定のため出力には使えない。 */
export async function createDailyReportTemplateAction(
  _prevState: DailyReportTemplateFormState,
  formData: FormData
): Promise<DailyReportTemplateFormState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file");

  if (!name) return { error: "雛形の名前を入力してください。" };
  if (!(file instanceof File) || file.size === 0) return { error: "Excelファイルを選択してください。" };

  const validationError = validateXlsxTemplateFile(file);
  if (validationError) return { error: validationError };

  const buffer = await fileToBuffer(file);
  let sheets;
  try {
    sheets = await listWorkbookSheets(buffer);
  } catch {
    return { error: "Excelファイルを読み取れませんでした。ファイルが壊れていないか確認してください。" };
  }
  if (sheets.length === 0) return { error: "シートが1つも見つかりませんでした。" };

  const template = await prisma.dailyReportTemplate.create({
    data: { companyId: admin.companyId, name, createdByUserId: admin.id },
  });
  const version = await prisma.dailyReportTemplateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      fileData: buffer,
      fileName: file.name,
      sheetName: sheets[0].name,
      workerSheetName: sheets[0].name,
      workerStartRow: 1,
      workerMaxRows: 0, // マッピング未保存の間は0件=出力に使えない
      fieldMappingJson: "{}",
      workerColumnsJson: "{}",
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "dailyReportTemplate.create",
    targetType: "DailyReportTemplate",
    targetId: template.id,
  });

  revalidatePath("/settings/daily-report-templates");
  redirect(`/settings/daily-report-templates/${template.id}/versions/${version.id}/mapping`);
}

/** 既存の雛形に新しいファイルを登録し直す(レイアウトが変わった場合)。マッピングは引き継がず作り直す。 */
export async function addDailyReportTemplateVersionAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const file = formData.get("file");

  const template = await prisma.dailyReportTemplate.findFirst({
    where: { id: templateId, companyId: admin.companyId },
  });
  if (!template) redirect("/settings/daily-report-templates");
  if (!(file instanceof File) || file.size === 0) {
    revalidatePath(`/settings/daily-report-templates/${templateId}`);
    return;
  }
  const validationError = validateXlsxTemplateFile(file);
  if (validationError) {
    revalidatePath(`/settings/daily-report-templates/${templateId}`);
    return;
  }

  const buffer = await fileToBuffer(file);
  let sheets;
  try {
    sheets = await listWorkbookSheets(buffer);
  } catch {
    revalidatePath(`/settings/daily-report-templates/${templateId}`);
    return;
  }
  if (sheets.length === 0) {
    revalidatePath(`/settings/daily-report-templates/${templateId}`);
    return;
  }

  const latest = await prisma.dailyReportTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });
  const version = await prisma.dailyReportTemplateVersion.create({
    data: {
      templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      fileData: buffer,
      fileName: file.name,
      sheetName: sheets[0].name,
      workerSheetName: sheets[0].name,
      workerStartRow: 1,
      workerMaxRows: 0,
      fieldMappingJson: "{}",
      workerColumnsJson: "{}",
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "dailyReportTemplate.newVersion",
    targetType: "DailyReportTemplateVersion",
    targetId: version.id,
  });

  redirect(`/settings/daily-report-templates/${templateId}/versions/${version.id}/mapping`);
}

/**
 * マッピング画面の保存。編集のたびに新しいバージョンを作る(すでにこのバージョンを使って
 * 発行した日報の出力内容が、後からの編集で変わらないようにするため)。
 */
export async function saveDailyReportTemplateMappingAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const baseVersionId = String(formData.get("versionId") ?? "");

  const template = await prisma.dailyReportTemplate.findFirst({
    where: { id: templateId, companyId: admin.companyId },
  });
  if (!template) redirect("/settings/daily-report-templates");
  const baseVersion = await prisma.dailyReportTemplateVersion.findFirst({
    where: { id: baseVersionId, templateId },
  });
  if (!baseVersion) redirect(`/settings/daily-report-templates/${templateId}`);

  const sheetName = String(formData.get("sheetName") ?? "").trim() || baseVersion.sheetName;
  const workerSheetName = String(formData.get("workerSheetName") ?? "").trim() || baseVersion.workerSheetName;
  const workerStartRow = Number(formData.get("workerStartRow") ?? "0");
  const workerMaxRows = Number(formData.get("workerMaxRows") ?? "0");

  if (!Number.isInteger(workerStartRow) || workerStartRow < 1) {
    redirect(`/settings/daily-report-templates/${templateId}/versions/${baseVersionId}/mapping?error=row`);
  }
  if (!Number.isInteger(workerMaxRows) || workerMaxRows < 0 || workerMaxRows > 500) {
    redirect(`/settings/daily-report-templates/${templateId}/versions/${baseVersionId}/mapping?error=maxrows`);
  }

  const fieldMapping: Record<string, string> = {};
  for (const key of DAILY_REPORT_TEMPLATE_FIELD_KEYS) {
    const raw = String(formData.get(`field_${key}`) ?? "").trim().toUpperCase();
    if (raw && isValidCellAddress(raw)) fieldMapping[key] = raw;
  }

  const workerColumns: Record<string, string> = {};
  for (const key of DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS) {
    const raw = String(formData.get(`worker_${key}`) ?? "").trim().toUpperCase();
    if (raw && isValidColumnLetter(raw)) workerColumns[key] = raw;
  }

  // 作業員一覧を書く列が1つも無いのに件数だけ設定しても意味が無い(出力時に何も書かれない状態を防ぐ)。
  const hasWorkerColumn = Object.keys(workerColumns).length > 0;
  const effectiveMaxRows = hasWorkerColumn ? workerMaxRows : 0;

  const latest = await prisma.dailyReportTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });
  const newVersion = await prisma.dailyReportTemplateVersion.create({
    data: {
      templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      fileData: baseVersion.fileData,
      fileName: baseVersion.fileName,
      sheetName,
      workerSheetName,
      workerStartRow,
      workerMaxRows: effectiveMaxRows,
      fieldMappingJson: JSON.stringify(fieldMapping),
      workerColumnsJson: JSON.stringify(workerColumns),
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "dailyReportTemplate.saveMapping",
    targetType: "DailyReportTemplateVersion",
    targetId: newVersion.id,
  });

  revalidatePath("/settings/daily-report-templates");
  redirect(`/settings/daily-report-templates/${templateId}?saved=1`);
}

export async function setDailyReportTemplateActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const isActive = formData.get("isActive") === "true";

  await prisma.dailyReportTemplate.updateMany({
    where: { id: templateId, companyId: admin.companyId },
    data: { isActive },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: isActive ? "dailyReportTemplate.activate" : "dailyReportTemplate.deactivate",
    targetType: "DailyReportTemplate",
    targetId: templateId,
  });

  revalidatePath("/settings/daily-report-templates");
}
