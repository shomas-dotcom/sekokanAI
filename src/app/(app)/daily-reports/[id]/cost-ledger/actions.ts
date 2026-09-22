"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import { prepareImageForVision } from "@/lib/imageConversion";
import { extractExpenseSlipFromImage, extractExpenseSlipFromPdf, type ExpenseSlipExtraction } from "@/lib/ai";

// 原価集計表(既存Excel日報の氏名・単価・残業・職種表、車両/機械・材料表、協力会社表)の
// 明細行を管理する。単価は給与相当の機微情報のため、この区画は手動入力のみとし、
// 音声入力ボタンは配置しない(REQUIREMENTS.md「推測で埋めない」方針にも合致)。

async function assertOwnedReport(dailyReportId: string, companyId: string) {
  const report = await prisma.dailyReport.findFirst({ where: { id: dailyReportId, companyId } });
  if (!report) throw new Error("日報が見つかりません。");
  return report;
}

export async function addLaborEntryAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const workerName = String(formData.get("workerName") ?? "").trim();
  if (!workerName) {
    revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
    return;
  }
  const unitPriceStr = String(formData.get("unitPrice") ?? "").trim();
  const overtimeHoursStr = String(formData.get("overtimeHours") ?? "").trim();
  const jobType = String(formData.get("jobType") ?? "").trim() || null;
  const workDescription = String(formData.get("workDescription") ?? "").trim() || null;
  const sortOrder = await prisma.dailyReportLaborEntry.count({ where: { dailyReportId } });

  const entry = await prisma.dailyReportLaborEntry.create({
    data: {
      dailyReportId,
      sortOrder,
      workerName,
      unitPrice: unitPriceStr ? Number(unitPriceStr) : null,
      overtimeHours: overtimeHoursStr ? Number(overtimeHoursStr) : null,
      jobType,
      workDescription,
    },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReportLaborEntry.create",
    targetType: "DailyReportLaborEntry",
    targetId: entry.id,
  });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export async function deleteLaborEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportLaborEntry.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export async function addOwnItemAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
    return;
  }
  const kindRaw = String(formData.get("kind") ?? "");
  const kind = kindRaw === "MATERIAL" ? "MATERIAL" : "VEHICLE_MACHINERY";
  const quantity = String(formData.get("quantity") ?? "").trim() || null;
  const amountStr = String(formData.get("amount") ?? "").trim();
  const sortOrder = await prisma.dailyReportOwnItem.count({ where: { dailyReportId, kind } });

  const item = await prisma.dailyReportOwnItem.create({
    data: {
      dailyReportId,
      kind,
      sortOrder,
      name,
      quantity,
      amount: amountStr ? Number(amountStr) : null,
    },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReportOwnItem.create",
    targetType: "DailyReportOwnItem",
    targetId: item.id,
  });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export async function deleteOwnItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportOwnItem.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export async function addPartnerItemAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
    return;
  }
  const kindRaw = String(formData.get("kind") ?? "");
  const kind = kindRaw === "OTHER_EXPENSE" ? "OTHER_EXPENSE" : "PARTNER_EQUIPMENT";
  const quantity = String(formData.get("quantity") ?? "").trim() || null;
  const unitPriceStr = String(formData.get("unitPrice") ?? "").trim();
  const sortOrder = await prisma.dailyReportPartnerItem.count({ where: { dailyReportId, kind } });

  const item = await prisma.dailyReportPartnerItem.create({
    data: {
      dailyReportId,
      kind,
      sortOrder,
      name,
      quantity,
      unitPrice: unitPriceStr ? Number(unitPriceStr) : null,
    },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReportPartnerItem.create",
    targetType: "DailyReportPartnerItem",
    targetId: item.id,
  });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export async function deletePartnerItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportPartnerItem.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/cost-ledger`);
}

export type ExpenseSlipScanState = { error?: string; extraction?: ExpenseSlipExtraction } | undefined;

/**
 * 協力会社(外注先)の請求書・伝票(画像/PDF)をAIに読み取らせ、原価集計表の
 * 「協力会社持込資機材」「その他経費」欄への仮入力候補を作る。ここではDBを
 * 一切更新しない — 実際に追加するかどうかは、確認画面でaddPartnerItemAction
 * (既存の手入力用アクション)を押した時点で人間が決める。
 */
export async function scanExpenseSlipAction(
  _prevState: ExpenseSlipScanState,
  formData: FormData
): Promise<ExpenseSlipScanState> {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "伝票の画像またはPDFを選択してください。" };
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let mimeType = file.type;
  if (mimeType !== "application/pdf") {
    const prepared = await prepareImageForVision(buffer, mimeType);
    buffer = prepared.buffer;
    mimeType = prepared.mimeType;
  }

  const validationError = validateAiDocumentFile({ type: mimeType, size: buffer.length });
  if (validationError) return { error: validationError };

  const base64 = buffer.toString("base64");
  const usageContext = { companyId: user.companyId, userId: user.id, feature: "costLedger.scanExpenseSlip" };
  const extraction =
    mimeType === "application/pdf"
      ? await extractExpenseSlipFromPdf(base64, usageContext)
      : await extractExpenseSlipFromImage(base64, mimeType as "image/jpeg" | "image/png" | "image/webp", usageContext);

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。もう一度お試しいただくか、手入力してください。",
    };
  }

  return { extraction };
}
