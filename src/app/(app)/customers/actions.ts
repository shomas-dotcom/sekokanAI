"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export type CustomerFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "顧客名は必須です。" };

  const customer = await prisma.customer.create({
    data: { ...data, companyId: user.companyId },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.create",
    targetType: "Customer",
    targetId: customer.id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.name) return { error: "顧客名は必須です。" };

  // companyId をwhere句に含めることで他社の顧客を更新できないようにする
  const result = await prisma.customer.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "顧客が見つかりません。" };

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.update",
    targetType: "Customer",
    targetId: id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomerAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.customer.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.delete",
    targetType: "Customer",
    targetId: id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}
