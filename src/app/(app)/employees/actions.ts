"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
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

  const employee = await prisma.employee.create({ data: { ...data, companyId: user.companyId } });
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
