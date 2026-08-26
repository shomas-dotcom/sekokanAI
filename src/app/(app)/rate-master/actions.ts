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

  const item = await prisma.rateMasterItem.create({ data: { ...data, companyId: user.companyId } });
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

  const result = await prisma.rateMasterItem.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "単価マスタが見つかりません。" };

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
