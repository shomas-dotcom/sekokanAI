"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { prisma } from "@/lib/prisma";

function toInt(value: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

async function logAdminAction(adminId: string, action: string) {
  await prisma.platformAdminAuditLog.create({ data: { adminId, action } });
}

export async function createPlanAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!key || !name) return; // 必須項目が空の場合は何もしない(フォーム側でrequired指定済み)

  await prisma.plan.create({
    data: {
      key,
      name,
      monthlyPrice: toInt(formData.get("monthlyPrice")),
      setupFee: toInt(formData.get("setupFee")),
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  await logAdminAction(admin.id, `plan.create:${key}`);
  revalidatePath("/admin/plans");
}

export async function updatePlanAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.plan.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      monthlyPrice: toInt(formData.get("monthlyPrice")),
      setupFee: toInt(formData.get("setupFee")),
      description: String(formData.get("description") ?? "").trim() || null,
      isActive: formData.get("isActive") === "on",
    },
  });
  await logAdminAction(admin.id, `plan.update:${id}`);
  revalidatePath("/admin/plans");
}
