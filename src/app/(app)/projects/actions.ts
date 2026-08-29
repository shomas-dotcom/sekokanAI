"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import {
  extractProjectRequestFromText,
  extractProjectRequestFromImage,
  extractProjectRequestFromPdf,
  type ProjectRequestExtraction,
} from "@/lib/ai";
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
    primeContractorName: String(formData.get("primeContractorName") ?? "").trim() || null,
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
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
    castingDate: parseDate(formData.get("castingDate")),
    suppliedItems: String(formData.get("suppliedItems") ?? "").trim() || null,
    soilQuantity: String(formData.get("soilQuantity") ?? "").trim() || null,
    cautions: String(formData.get("cautions") ?? "").trim() || null,
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

export async function updateProjectMembersAction(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return;

  const employeeIds = formData.getAll("employeeId").map(String);
  // 選択された従業員が自社所属であることを確認してから割り当てる(他社の従業員を紐付けられないように)
  const validEmployees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, companyId: user.companyId },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.projectMember.deleteMany({ where: { projectId } }),
    prisma.projectMember.createMany({
      data: validEmployees.map((e) => ({ projectId, employeeId: e.id })),
    }),
  ]);

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "project.updateMembers",
    targetType: "Project",
    targetId: projectId,
  });

  revalidatePath(`/projects/${projectId}`);
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

export type ProjectRequestScanState =
  | { error: string; extraction?: undefined; matchedCustomerId?: undefined }
  | { error?: undefined; extraction: ProjectRequestExtraction; matchedCustomerId: string | null }
  | undefined;

/**
 * 見積依頼(文章・画像・PDF)を読み取り、案件登録フォームへの仮入力を作る。
 * ここではDBへの保存は一切行わない(既存のcreateProjectActionが担う)。
 * 顧客名は自由記述で読み取られるため、既存の顧客マスタと部分一致で
 * 突き合わせ、一致すればプルダウンの初期選択に使う(一致しなければ
 * 手動で選択・新規登録してもらう)。
 */
export async function scanProjectRequestAction(
  _prevState: ProjectRequestScanState,
  formData: FormData
): Promise<ProjectRequestScanState> {
  const user = await requireUser();
  const transcript = String(formData.get("transcript") ?? "").trim();
  const file = formData.get("file");

  let extraction: ProjectRequestExtraction;

  if (file instanceof File && file.size > 0) {
    const validationError = validateAiDocumentFile(file);
    if (validationError) return { error: validationError };

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    extraction =
      file.type === "application/pdf"
        ? await extractProjectRequestFromPdf(base64)
        : await extractProjectRequestFromImage(base64, file.type as "image/jpeg" | "image/png" | "image/webp");
  } else if (transcript) {
    extraction = await extractProjectRequestFromText(transcript);
  } else {
    return { error: "写真・PDFを選択するか、依頼内容を入力してください。" };
  }

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。もう一度お試しいただくか、手入力してください。",
    };
  }

  let matchedCustomerId: string | null = null;
  if (extraction.customerName) {
    const matched = await prisma.customer.findFirst({
      where: { companyId: user.companyId, name: { contains: extraction.customerName, mode: "insensitive" } },
      select: { id: true },
    });
    matchedCustomerId = matched?.id ?? null;
  }

  await logAction({ companyId: user.companyId, userId: user.id, action: "project.scanRequest" });

  return { extraction, matchedCustomerId };
}
