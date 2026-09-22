"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import type { RateCategory } from "@/generated/prisma/enums";
import { RATE_CATEGORY_LABEL } from "@/lib/rateMaster";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import { prepareImageForVision } from "@/lib/imageConversion";
import { extractRatePriceFromImage, extractRatePriceFromPdf, type RatePriceExtraction } from "@/lib/ai";

export type RateMasterFormState = { error?: string } | undefined;

const CATEGORIES = Object.keys(RATE_CATEGORY_LABEL) as RateCategory[];

function readForm(formData: FormData) {
  const category = String(formData.get("category") ?? "OTHER") as RateCategory;
  const unitPrice = Number(formData.get("unitPrice") ?? 0);
  const costPriceRaw = String(formData.get("costPrice") ?? "").trim();
  return {
    category: CATEGORIES.includes(category) ? category : "OTHER",
    name: String(formData.get("name") ?? "").trim(),
    unit: String(formData.get("unit") ?? "").trim() || "式",
    unitPrice: Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0,
    costPrice: costPriceRaw ? Math.round(Number(costPriceRaw)) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createRateMasterItemAction(
  _prevState: RateMasterFormState,
  formData: FormData
): Promise<RateMasterFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "品目名は必須です。" };

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.rateMasterItem.create({ data: { ...data, companyId: user.companyId } });
    // 登録時点の単価を最初の履歴として残す(単価履歴を「上書きではなく積み重ねる」方針のため)
    await tx.rateMasterPriceHistory.create({
      data: {
        companyId: user.companyId,
        rateMasterItemId: created.id,
        unitPrice: created.unitPrice,
        costPrice: created.costPrice,
      },
    });
    return created;
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "rateMasterItem.create",
    targetType: "RateMasterItem",
    targetId: item.id,
  });

  revalidatePath("/rate-master");
  redirect("/rate-master");
}

export async function updateRateMasterItemAction(
  _prevState: RateMasterFormState,
  formData: FormData
): Promise<RateMasterFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.name) return { error: "品目名は必須です。" };

  const existing = await prisma.rateMasterItem.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) return { error: "単価マスタが見つかりません。" };

  await prisma.$transaction(async (tx) => {
    await tx.rateMasterItem.update({ where: { id }, data });
    // 単価(売単価・原価)が実際に変わった場合のみ履歴を積む(名称のみの修正等では
    // 履歴を汚さない)
    if (existing.unitPrice !== data.unitPrice || existing.costPrice !== data.costPrice) {
      await tx.rateMasterPriceHistory.create({
        data: {
          companyId: user.companyId,
          rateMasterItemId: id,
          unitPrice: data.unitPrice,
          costPrice: data.costPrice,
        },
      });
    }
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "rateMasterItem.update",
    targetType: "RateMasterItem",
    targetId: id,
  });

  revalidatePath("/rate-master");
  redirect("/rate-master");
}

export type RateScanState = { error?: string; extraction?: RatePriceExtraction } | undefined;

/**
 * 外注先・仕入先からの見積書(画像/PDF)を読み取り、指定した品目の単価候補を提案する。
 * ここではDBを一切更新しない(AIは単価を勝手に確定しない、REQUIREMENTS.mdの方針どおり)。
 * 実際に単価マスタへ反映するかどうかは、確認画面でapplyRatePriceActionを押した時点で決まる。
 */
export async function scanRatePriceAction(
  _prevState: RateScanState,
  formData: FormData
): Promise<RateScanState> {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "");
  const file = formData.get("file");

  const item = await prisma.rateMasterItem.findFirst({ where: { id: itemId, companyId: user.companyId } });
  if (!item) return { error: "単価マスタが見つかりません。" };
  if (!(file instanceof File) || file.size === 0) return { error: "見積書の画像またはPDFを選択してください。" };

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
  const usageContext = { companyId: user.companyId, userId: user.id, feature: "rateMaster.scanPrice" };
  const extraction =
    mimeType === "application/pdf"
      ? await extractRatePriceFromPdf(base64, item.name, usageContext)
      : await extractRatePriceFromImage(base64, mimeType as "image/jpeg" | "image/png" | "image/webp", item.name, usageContext);

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "この見積書からは単価を読み取れませんでした。AI連携が設定されていないか、品目名が見積書に見当たらない可能性があります。手動で入力してください。",
    };
  }

  return { extraction };
}

/** AIの提案どおり(または確認画面で修正した内容)を単価マスタへ反映する。 */
export async function applyRatePriceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const unitPriceStr = String(formData.get("unitPrice") ?? "").trim();
  const costPriceStr = String(formData.get("costPrice") ?? "").trim();
  const sourceDescription = String(formData.get("sourceDescription") ?? "").trim() || null;

  if (!unitPriceStr) redirect(`/rate-master/${id}?scanError=unitPrice_required`);

  const existing = await prisma.rateMasterItem.findFirst({ where: { id, companyId: user.companyId } });
  if (!existing) redirect("/rate-master");

  const unitPrice = Math.round(Number(unitPriceStr));
  const costPrice = costPriceStr ? Math.round(Number(costPriceStr)) : null;

  await prisma.$transaction(async (tx) => {
    await tx.rateMasterItem.update({ where: { id }, data: { unitPrice, costPrice } });
    await tx.rateMasterPriceHistory.create({
      data: {
        companyId: user.companyId,
        rateMasterItemId: id,
        unitPrice,
        costPrice,
        note: sourceDescription ? `AIによる見積書読み取り: ${sourceDescription}` : "AIによる見積書読み取り",
      },
    });
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "rateMasterItem.update",
    targetType: "RateMasterItem",
    targetId: id,
  });

  revalidatePath("/rate-master");
  revalidatePath(`/rate-master/${id}`);
  redirect(`/rate-master/${id}`);
}

export async function deleteRateMasterItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.rateMasterItem.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "rateMasterItem.delete",
    targetType: "RateMasterItem",
    targetId: id,
  });

  revalidatePath("/rate-master");
  redirect("/rate-master");
}
