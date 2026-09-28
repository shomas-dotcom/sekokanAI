"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateXlsxTemplateFile } from "@/lib/fileValidation";
import { checkStorageForUpload } from "@/lib/companyLimits";
import { listWorkbookSheets } from "@/lib/xlsx/sheetPreview";
import {
  QUOTE_TEMPLATE_FIELD_KEYS,
  QUOTE_TEMPLATE_ITEM_COLUMN_KEYS,
  isValidCellAddress,
  isValidColumnLetter,
} from "@/lib/xlsx/quoteTemplateFields";

export type QuoteTemplateFormState = { error?: string } | undefined;

async function fileToBuffer(file: File): Promise<Buffer<ArrayBuffer>> {
  return Buffer.from(await file.arrayBuffer());
}

/** 新しい雛形(1件目のバージョン)を登録する。この時点ではマッピング未設定のため出力には使えない。 */
export async function createQuoteTemplateAction(
  _prevState: QuoteTemplateFormState,
  formData: FormData
): Promise<QuoteTemplateFormState> {
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

  // 保存容量の上限(F13)
  const storageError = await checkStorageForUpload(admin.companyId, buffer.length);
  if (storageError) return { error: storageError };

  const template = await prisma.quoteTemplate.create({
    data: { companyId: admin.companyId, name, createdByUserId: admin.id },
  });
  const version = await prisma.quoteTemplateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      fileData: buffer,
      fileName: file.name,
      sheetName: sheets[0].name,
      itemSheetName: sheets[0].name,
      itemStartRow: 1,
      itemMaxRows: 0, // マッピング未保存の間は0件=出力に使えない
      fieldMappingJson: "{}",
      itemColumnsJson: "{}",
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "quoteTemplate.create",
    targetType: "QuoteTemplate",
    targetId: template.id,
  });

  revalidatePath("/settings/quote-templates");
  redirect(`/settings/quote-templates/${template.id}/versions/${version.id}/mapping`);
}

/** 既存の雛形に新しいファイルを登録し直す(レイアウトが変わった場合)。マッピングは引き継がず作り直す。 */
export async function addQuoteTemplateVersionAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const file = formData.get("file");

  const template = await prisma.quoteTemplate.findFirst({ where: { id: templateId, companyId: admin.companyId } });
  if (!template) redirect("/settings/quote-templates");
  if (!(file instanceof File) || file.size === 0) {
    revalidatePath(`/settings/quote-templates/${templateId}`);
    return;
  }
  const validationError = validateXlsxTemplateFile(file);
  if (validationError) {
    revalidatePath(`/settings/quote-templates/${templateId}`);
    return;
  }

  const buffer = await fileToBuffer(file);
  let sheets;
  try {
    sheets = await listWorkbookSheets(buffer);
  } catch {
    revalidatePath(`/settings/quote-templates/${templateId}`);
    return;
  }
  if (sheets.length === 0) {
    revalidatePath(`/settings/quote-templates/${templateId}`);
    return;
  }
  // 保存容量の上限(F13)。黙って何もしないと理由が分からないため、画面に理由を出す。
  if (await checkStorageForUpload(admin.companyId, buffer.length)) {
    redirect(`/settings/quote-templates/${templateId}?error=storage`);
  }

  const latest = await prisma.quoteTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });
  const version = await prisma.quoteTemplateVersion.create({
    data: {
      templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      fileData: buffer,
      fileName: file.name,
      sheetName: sheets[0].name,
      itemSheetName: sheets[0].name,
      itemStartRow: 1,
      itemMaxRows: 0,
      fieldMappingJson: "{}",
      itemColumnsJson: "{}",
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "quoteTemplate.newVersion",
    targetType: "QuoteTemplateVersion",
    targetId: version.id,
  });

  redirect(`/settings/quote-templates/${templateId}/versions/${version.id}/mapping`);
}

/**
 * マッピング画面の保存。編集のたびに新しいバージョンを作る(すでにこのバージョンを使って
 * 発行した見積の出力内容が、後からの編集で変わらないようにするため)。
 */
export async function saveQuoteTemplateMappingAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const baseVersionId = String(formData.get("versionId") ?? "");

  const template = await prisma.quoteTemplate.findFirst({ where: { id: templateId, companyId: admin.companyId } });
  if (!template) redirect("/settings/quote-templates");
  const baseVersion = await prisma.quoteTemplateVersion.findFirst({ where: { id: baseVersionId, templateId } });
  if (!baseVersion) redirect(`/settings/quote-templates/${templateId}`);

  const sheetName = String(formData.get("sheetName") ?? "").trim() || baseVersion.sheetName;
  const itemSheetName = String(formData.get("itemSheetName") ?? "").trim() || baseVersion.itemSheetName;
  const itemStartRow = Number(formData.get("itemStartRow") ?? "0");
  const itemMaxRows = Number(formData.get("itemMaxRows") ?? "0");

  if (!Number.isInteger(itemStartRow) || itemStartRow < 1) {
    redirect(`/settings/quote-templates/${templateId}/versions/${baseVersionId}/mapping?error=row`);
  }
  if (!Number.isInteger(itemMaxRows) || itemMaxRows < 0 || itemMaxRows > 500) {
    redirect(`/settings/quote-templates/${templateId}/versions/${baseVersionId}/mapping?error=maxrows`);
  }

  const fieldMapping: Record<string, string> = {};
  for (const key of QUOTE_TEMPLATE_FIELD_KEYS) {
    const raw = String(formData.get(`field_${key}`) ?? "").trim().toUpperCase();
    if (raw && isValidCellAddress(raw)) fieldMapping[key] = raw;
  }

  const itemColumns: Record<string, string> = {};
  for (const key of QUOTE_TEMPLATE_ITEM_COLUMN_KEYS) {
    const raw = String(formData.get(`item_${key}`) ?? "").trim().toUpperCase();
    if (raw && isValidColumnLetter(raw)) itemColumns[key] = raw;
  }

  // 明細を書く列が1つも無いのに件数だけ設定しても意味が無い(出力時に何も書かれない状態を防ぐ)。
  const hasItemColumn = Object.keys(itemColumns).length > 0;
  const effectiveMaxRows = hasItemColumn ? itemMaxRows : 0;

  const latest = await prisma.quoteTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { versionNumber: "desc" },
  });
  const newVersion = await prisma.quoteTemplateVersion.create({
    data: {
      templateId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      fileData: baseVersion.fileData,
      fileName: baseVersion.fileName,
      sheetName,
      itemSheetName,
      itemStartRow,
      itemMaxRows: effectiveMaxRows,
      fieldMappingJson: JSON.stringify(fieldMapping),
      itemColumnsJson: JSON.stringify(itemColumns),
      createdByUserId: admin.id,
    },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "quoteTemplate.saveMapping",
    targetType: "QuoteTemplateVersion",
    targetId: newVersion.id,
  });

  revalidatePath("/settings/quote-templates");
  redirect(`/settings/quote-templates/${templateId}?saved=1`);
}

export async function setQuoteTemplateActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const templateId = String(formData.get("templateId") ?? "");
  const isActive = formData.get("isActive") === "true";

  await prisma.quoteTemplate.updateMany({
    where: { id: templateId, companyId: admin.companyId },
    data: { isActive },
  });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: isActive ? "quoteTemplate.activate" : "quoteTemplate.deactivate",
    targetType: "QuoteTemplate",
    targetId: templateId,
  });

  revalidatePath("/settings/quote-templates");
}
