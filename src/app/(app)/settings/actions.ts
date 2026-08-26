"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export type SettingsFormState = { error?: string } | undefined;

function trimmedOrNull(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

export async function updateCompanyAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "会社名は必須です。" };

  const employeeCountRaw = trimmedOrNull(formData, "employeeCount");
  const employeeCount = employeeCountRaw ? Number(employeeCountRaw) : null;
  if (employeeCountRaw && (!Number.isFinite(employeeCount) || employeeCount! < 0)) {
    return { error: "従業員数は0以上の数値で入力してください。" };
  }

  await prisma.company.update({
    where: { id: user.companyId },
    data: {
      name,
      postalCode: trimmedOrNull(formData, "postalCode"),
      address: trimmedOrNull(formData, "address"),
      phone: trimmedOrNull(formData, "phone"),
      fax: trimmedOrNull(formData, "fax"),
      email: trimmedOrNull(formData, "email"),
      representativeName: trimmedOrNull(formData, "representativeName"),
      industry: trimmedOrNull(formData, "industry"),
      employeeCount,
      licenseNumber: trimmedOrNull(formData, "licenseNumber"),
      invoiceRegistrationNumber: trimmedOrNull(formData, "invoiceRegistrationNumber"),
      bankName: trimmedOrNull(formData, "bankName"),
      bankBranch: trimmedOrNull(formData, "bankBranch"),
      bankAccountType: trimmedOrNull(formData, "bankAccountType"),
      bankAccountNumber: trimmedOrNull(formData, "bankAccountNumber"),
      bankAccountHolder: trimmedOrNull(formData, "bankAccountHolder"),
      logoUrl: trimmedOrNull(formData, "logoUrl"),
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "company.update",
    targetType: "Company",
    targetId: user.companyId,
  });

  revalidatePath("/settings");
  redirect("/settings");
}
