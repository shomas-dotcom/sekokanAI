"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import type { ProjectStatus } from "@/generated/prisma/enums";

export type ProjectFormState = { error?: string } | undefined;

const STATUSES: ProjectStatus[] = [
  "LEAD",
  "ESTIMATING",
  "CONTRACTED",
  "IN_PROGRESS",
  "COMPLETED",
  "LOST",
];

function readForm(formData: FormData) {
  const status = String(formData.get("status") ?? "LEAD") as ProjectStatus;
  return {
    customerId: String(formData.get("customerId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    siteAddress: String(formData.get("siteAddress") ?? "").trim() || null,
    orderingParty: String(formData.get("orderingParty") ?? "").trim() || null,
    status: STATUSES.includes(status) ? status : "LEAD",
  };
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "案件名は必須です。" };
  if (!data.customerId) return { error: "顧客を選択してください。" };

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId: user.companyId },
  });
  if (!customer) return { error: "顧客が見つかりません。" };

  const project = await prisma.project.create({
    data: { ...data, companyId: user.companyId },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "project.create",
    targetType: "Project",
    targetId: project.id,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectAction(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.name) return { error: "案件名は必須です。" };

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId: user.companyId },
  });
  if (!customer) return { error: "顧客が見つかりません。" };

  const result = await prisma.project.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "案件が見つかりません。" };

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "project.update",
    targetType: "Project",
    targetId: id,
  });

  revalidatePath("/projects");
  redirect("/projects");
}

export async function deleteProjectAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.project.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "project.delete",
    targetType: "Project",
    targetId: id,
  });

  revalidatePath("/projects");
  redirect("/projects");
}
