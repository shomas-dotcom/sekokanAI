"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import {
  extractEmployeeFieldsFromText,
  extractIdCardFromImage,
  extractIdCardFromPdf,
  type EmployeeFieldExtraction,
  type IdCardExtraction,
} from "@/lib/ai";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import type { EmploymentType } from "@/generated/prisma/enums";

export type EmployeeFormState = { error?: string } | undefined;

const EMPLOYMENT_TYPES: EmploymentType[] = ["REGULAR", "PART_TIME", "SUBCONTRACTOR", "OTHER"];

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readForm(formData: FormData) {
  const employmentType = String(formData.get("employmentType") ?? "REGULAR") as EmploymentType;
  return {
    name: String(formData.get("name") ?? "").trim(),
    nameKana: String(formData.get("nameKana") ?? "").trim() || null,
    position: String(formData.get("position") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    employmentType: EMPLOYMENT_TYPES.includes(employmentType) ? employmentType : "REGULAR",
    hireDate: parseDate(formData.get("hireDate")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createEmployeeAction(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "氏名は必須です。" };

  // 身分証読み取りで免許情報が取得できていた場合、保有資格として一緒に登録する
  // (生年月日・住所・免許証番号そのものはこの時点で画面表示のみに使われ、渡って来ない)
  const qualificationName = String(formData.get("initialQualificationName") ?? "").trim() || null;
  const qualificationExpiresAt = parseDate(formData.get("initialQualificationExpiresAt"));

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({ data: { ...data, companyId: user.companyId } });
    if (qualificationName) {
      await tx.employeeQualification.create({
        data: { employeeId: created.id, name: qualificationName, expiresAt: qualificationExpiresAt },
      });
    }
    return created;
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "employee.create",
    targetType: "Employee",
    targetId: employee.id,
  });

  revalidatePath("/employees");
  redirect(`/employees/${employee.id}`);
}

export async function updateEmployeeAction(
  _prevState: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.name) return { error: "氏名は必須です。" };

  const result = await prisma.employee.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "従業員が見つかりません。" };

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "employee.update",
    targetType: "Employee",
    targetId: id,
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}`);
}

export async function deleteEmployeeAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.employee.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "employee.delete",
    targetType: "Employee",
    targetId: id,
  });

  revalidatePath("/employees");
  redirect("/employees");
}

export type EmployeeVoiceFillState = { error?: string; extraction?: EmployeeFieldExtraction } | undefined;

/** 「まとめて音声入力する」欄。ここでもDB保存はせず、フォームへの仮入力に留める。 */
export async function scanEmployeeVoiceAction(
  _prevState: EmployeeVoiceFillState,
  formData: FormData
): Promise<EmployeeVoiceFillState> {
  await requireUser();
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) return { error: "マイクで話すか、内容を入力してください。" };

  const extraction = await extractEmployeeFieldsFromText(transcript);
  return { extraction };
}

export type QualificationFormState = { error?: string } | undefined;

export async function addQualificationAction(
  _prevState: QualificationFormState,
  formData: FormData
): Promise<QualificationFormState> {
  const user = await requireUser();
  const employeeId = String(formData.get("employeeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const expiresAt = parseDate(formData.get("expiresAt"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { error: "資格名は必須です。" };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: user.companyId },
  });
  if (!employee) return { error: "従業員が見つかりません。" };

  await prisma.employeeQualification.create({
    data: { employeeId, name, expiresAt, notes },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "employeeQualification.create",
    targetType: "Employee",
    targetId: employeeId,
  });

  revalidatePath(`/employees/${employeeId}`);
  return undefined;
}

export async function deleteQualificationAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");

  // employeeId経由でcompanyIdを確認してから削除する(他社の資格レコードを消せないように)
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: user.companyId },
  });
  if (!employee) return;

  await prisma.employeeQualification.deleteMany({ where: { id, employeeId } });
  revalidatePath(`/employees/${employeeId}`);
}

export type IdCardScanState = { error: string; extraction?: undefined } | { error?: undefined; extraction: IdCardExtraction } | undefined;

/**
 * 身分証(運転免許証等)の画像/PDFを読み取る。画像そのものは一切保存しない
 * (受け取ったバッファはAIへの送信にのみ使い、この関数を抜けたら破棄される)。
 * DBに保存するのは氏名・フリガナと、免許の種類・有効期限(保有資格として)だけで、
 * 生年月日・住所・免許証番号は戻り値としてこの画面に一度表示するだけに留める
 * (REQUIREMENTS.mdの「必要以上の個人情報を保存しない」方針)。
 */
export async function scanIdCardAction(
  _prevState: IdCardScanState,
  formData: FormData
): Promise<IdCardScanState> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "身分証の画像またはPDFを選択してください。" };
  }
  const validationError = validateAiDocumentFile(file);
  if (validationError) return { error: validationError };

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const extraction =
    file.type === "application/pdf"
      ? await extractIdCardFromPdf(base64)
      : await extractIdCardFromImage(base64, file.type as "image/jpeg" | "image/png" | "image/webp");

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。もう一度お試しいただくか、手入力してください。",
    };
  }

  return { extraction };
}
