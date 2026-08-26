"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
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

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? Math.round(n) : null;
}

function readForm(formData: FormData) {
  const status = String(formData.get("status") ?? "LEAD") as ProjectStatus;
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const taxRatePercent = Number(formData.get("taxRatePercent") ?? 10);
  return {
    customerId: String(formData.get("customerId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    siteAddress: String(formData.get("siteAddress") ?? "").trim() || null,
    orderingParty: String(formData.get("orderingParty") ?? "").trim() || null,
    status: STATUSES.includes(status) ? status : "LEAD",
    startDate,
    endDate,
    managerName: String(formData.get("managerName") ?? "").trim() || null,
    siteAgentName: String(formData.get("siteAgentName") ?? "").trim() || null,
    chiefEngineerName: String(formData.get("chiefEngineerName") ?? "").trim() || null,
    contractAmountExcludingTax: parseIntOrNull(formData.get("contractAmountExcludingTax")),
    taxRatePercent: Number.isFinite(taxRatePercent) ? taxRatePercent : 10,
    paymentTerms: String(formData.get("paymentTerms") ?? "").trim() || null,
    overview: String(formData.get("overview") ?? "").trim() || null,
  };
}

function validateDates(data: { startDate: Date | null; endDate: Date | null }): string | null {
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    return "工事開始日は終了日より前の日付にしてください。";
  }
  return null;
}

export async function createProjectAction(
  _prevState: ProjectFormState,
  formData: FormData
): Promise<ProjectFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "案件名は必須です。" };
  if (!data.customerId) return { error: "顧客を選択してください。" };
  const dateError = validateDates(data);
  if (dateError) return { error: dateError };

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId: user.companyId },
  });
  if (!customer) return { error: "顧客が見つかりません。" };

  const projectCode = await nextDocumentNumber(user.companyId, "PROJECT");
  const project = await prisma.project.create({
    data: { ...data, projectCode, companyId: user.companyId },
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
  const dateError = validateDates(data);
  if (dateError) return { error: dateError };

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
