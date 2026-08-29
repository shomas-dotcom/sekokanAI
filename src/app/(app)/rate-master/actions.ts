"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import type { RateCategory } from "@/generated/prisma/enums";
import { RATE_CATEGORY_LABEL } from "@/lib/rateMaster";

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
