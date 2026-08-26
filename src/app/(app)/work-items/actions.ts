"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export type WorkItemFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  const sortOrderStr = String(formData.get("sortOrder") ?? "").trim();
  return {
    label: String(formData.get("label") ?? "").trim(),
    sortOrder: sortOrderStr ? Number(sortOrderStr) : 0,
  };
}

export async function createWorkItemAction(
  _prevState: WorkItemFormState,
  formData: FormData
): Promise<WorkItemFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.label) return { error: "作業内容は必須です。" };

  const workItem = await prisma.workItemMaster.create({
    data: { ...data, companyId: user.companyId },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "workItem.create",
    targetType: "WorkItemMaster",
    targetId: workItem.id,
  });

  revalidatePath("/work-items");
  redirect("/work-items");
}

export async function updateWorkItemAction(
  _prevState: WorkItemFormState,
  formData: FormData
): Promise<WorkItemFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.label) return { error: "作業内容は必須です。" };

  // companyId をwhere句に含めることで他社の作業内容マスタを更新できないようにする
  const result = await prisma.workItemMaster.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "作業内容が見つかりません。" };

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "workItem.update",
    targetType: "WorkItemMaster",
    targetId: id,
  });

  revalidatePath("/work-items");
  redirect("/work-items");
}

export async function deleteWorkItemAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.workItemMaster.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "workItem.delete",
    targetType: "WorkItemMaster",
    targetId: id,
  });

  revalidatePath("/work-items");
  redirect("/work-items");
}
