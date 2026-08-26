"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import type { RoundingMode } from "@/generated/prisma/enums";

const ROUNDING_MODES: RoundingMode[] = ["FLOOR", "ROUND", "CEIL"];

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

  const closingDayRaw = trimmedOrNull(formData, "closingDay");
  const closingDay = closingDayRaw ? Number(closingDayRaw) : null;
  if (closingDayRaw && (!Number.isFinite(closingDay) || closingDay! < 1 || closingDay! > 31)) {
    return { error: "締日は1〜31の数値で入力してください。" };
  }

  const roundingModeRaw = String(formData.get("defaultTaxRoundingMode") ?? "ROUND") as RoundingMode;
  const defaultTaxRoundingMode = ROUNDING_MODES.includes(roundingModeRaw) ? roundingModeRaw : "ROUND";

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
      closingDay,
      defaultPaymentTerms: trimmedOrNull(formData, "defaultPaymentTerms"),
      defaultTaxRoundingMode,
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
