"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { validateAiDocumentFile, validateDocumentFile } from "@/lib/fileValidation";
import { prepareImageForVision, prepareImageForStorage } from "@/lib/imageConversion";
import {
  extractProjectRequestFromText,
  extractProjectRequestFromImage,
  extractProjectRequestFromPdf,
  type ProjectRequestExtraction,
} from "@/lib/ai";
import type { ProjectStatus, DailyReportFormat } from "@/generated/prisma/enums";

export type ProjectFormState = { error?: string } | undefined;

const STATUSES: ProjectStatus[] = [
  "LEAD",
  "ESTIMATING",
  "CONTRACTED",
  "IN_PROGRESS",
  "COMPLETED",
  "LOST",
];

const REPORT_FORMATS: DailyReportFormat[] = ["STANDARD", "NIPPON_DORO_KOCHO"];

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
  const reportFormat = String(formData.get("reportFormat") ?? "STANDARD") as DailyReportFormat;
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  const taxRatePercent = Number(formData.get("taxRatePercent") ?? 10);
  return {
    customerId: String(formData.get("customerId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    siteAddress: String(formData.get("siteAddress") ?? "").trim() || null,
    orderingParty: String(formData.get("orderingParty") ?? "").trim() || null,
    primeContractorName: String(formData.get("primeContractorName") ?? "").trim() || null,
    reportFormat: REPORT_FORMATS.includes(reportFormat) ? reportFormat : "STANDARD",
    siteAbbreviation: String(formData.get("siteAbbreviation") ?? "").trim() || null,
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

  // 「写真・ファイル添付」タブで選ばれたファイル(新規登録画面のみ)。案件の作成自体を
  // 止めないよう、DBへ何も作る前にここで検証しておく。
  const attachedFiles = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of attachedFiles) {
    const validationError = validateDocumentFile(file);
    if (validationError) return { error: `${file.name}: ${validationError}` };
  }

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

  // 「写真・ファイル添付」タブで選ばれたファイルを、案件の「ファイル」欄へ保存する
  // (uploadProjectFileActionと同じ保存先・同じ検証を、登録と同じ画面で済ませられるようにしたもの)。
  for (const file of attachedFiles) {
    // HEIC/HEIFはiPhone以外の端末(Android・Windows等)のブラウザで表示できないことが
    // 多いため、社内の他の人も開けるようJPEGへ変換してから保存する。
    const { buffer, mimeType, fileName } = await prepareImageForStorage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      file.name
    );
    const saved = await prisma.projectFile.create({
      data: {
        companyId: user.companyId,
        projectId: project.id,
        fileName,
        mimeType,
        data: buffer,
        size: buffer.length,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "projectFile.create",
      targetType: "ProjectFile",
      targetId: saved.id,
    });
  }

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

/**
 * 現場責任者(User)の担当現場割当を更新する(管理者のみ)。ProjectMember(Employeeの
 * 現場配属名簿)とは別物 — こちらはログインアカウントに対する閲覧・一次承認の権限範囲。
 */
export async function updateProjectSupervisorsAction(formData: FormData) {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");

  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: admin.companyId } });
  if (!project) return;

  const userIds = formData.getAll("userId").map(String);
  const validUsers = await prisma.user.findMany({
    where: { id: { in: userIds }, companyId: admin.companyId, deletedAt: null },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.projectSupervisor.deleteMany({ where: { projectId } }),
    prisma.projectSupervisor.createMany({
      data: validUsers.map((u) => ({ projectId, userId: u.id })),
    }),
  ]);

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "project.updateSupervisors",
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
  // 「撮影」と「ファイル」で入力欄を分けているため、実際に中身が入っている方を使う
  // (片方が空でも、同名の欄が複数あるとブラウザは常に先の欄を優先して送ってしまうため)。
  const file = [formData.get("file"), formData.get("cameraFile")].find(
    (f): f is File => f instanceof File && f.size > 0
  );
  const usageContext = { companyId: user.companyId, userId: user.id, feature: "projectRequest.scan" };

  let extraction: ProjectRequestExtraction;

  if (file instanceof File && file.size > 0) {
    // iPhoneの初期設定(HEIC/HEIF)はAIが直接読み取れないため先にJPEGへ変換し、
    // あわせて大きすぎる写真は縮小する(メモリ・通信量を減らし、処理が重くなって
    // 接続が切れるのを防ぐ)。PDFはそのまま(画像処理の対象外)。
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
    extraction =
      mimeType === "application/pdf"
        ? await extractProjectRequestFromPdf(base64, usageContext)
        : await extractProjectRequestFromImage(
            base64,
            mimeType as "image/jpeg" | "image/png" | "image/webp",
            usageContext
          );
  } else if (transcript) {
    extraction = await extractProjectRequestFromText(transcript, usageContext);
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
