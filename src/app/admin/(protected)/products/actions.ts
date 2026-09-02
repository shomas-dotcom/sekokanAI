"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { prisma } from "@/lib/prisma";

function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function logAdminAction(adminId: string, action: string) {
  await prisma.platformAdminAuditLog.create({ data: { adminId, action } });
}

function readProductFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    targetCustomer: String(formData.get("targetCustomer") ?? "").trim() || null,
    price: toIntOrNull(formData.get("price")),
    monthlyPrice: toIntOrNull(formData.get("monthlyPrice")),
    setupFee: toIntOrNull(formData.get("setupFee")),
    featuresText: String(formData.get("featuresText") ?? "").trim() || null,
    salesStatus: (String(formData.get("salesStatus") ?? "DRAFT") as "DRAFT" | "ON_SALE" | "DISCONTINUED"),
  };
}

export async function createProductAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const fields = readProductFields(formData);
  if (!fields.name) return;

  const product = await prisma.product.create({ data: fields });
  await logAdminAction(admin.id, `product.create:${product.id}`);
  revalidatePath("/admin/products");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.product.update({ where: { id }, data: readProductFields(formData) });
  await logAdminAction(admin.id, `product.update:${id}`);
  revalidatePath("/admin/products");
}
