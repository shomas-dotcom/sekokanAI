"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 日本道路株式会社「工事日報」(共帳022-01)向けの明細入力。Project.reportFormatが
// NIPPON_DORO_KOCHOの案件でのみ使う画面のアクション(cost-ledger/actions.tsと同じ方針:
// 単価は給与相当の機微情報のため手動入力のみ)。

async function assertOwnedReport(dailyReportId: string, companyId: string) {
  const report = await prisma.dailyReport.findFirst({ where: { id: dailyReportId, companyId } });
  if (!report) throw new Error("日報が見つかりません。");
  return report;
}

export async function addWorkTypeEntryAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const workType = String(formData.get("workType") ?? "").trim();
  if (!workType) {
    revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
    return;
  }
  const dailyQuantityStr = String(formData.get("dailyQuantity") ?? "").trim();
  const dailyWorkerCountStr = String(formData.get("dailyWorkerCount") ?? "").trim();
  const externalProviderQuantityStr = String(formData.get("externalProviderQuantity") ?? "").trim();
  const externalProviderUnitPriceStr = String(formData.get("externalProviderUnitPrice") ?? "").trim();
  const sortOrder = await prisma.dailyReportWorkTypeEntry.count({ where: { dailyReportId } });

  await prisma.dailyReportWorkTypeEntry.create({
    data: {
      dailyReportId,
      sortOrder,
      workType,
      subItem: String(formData.get("subItem") ?? "").trim() || null,
      workArea: String(formData.get("workArea") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      dailyQuantity: dailyQuantityStr ? Number(dailyQuantityStr) : null,
      dailyWorkerCount: dailyWorkerCountStr ? Math.round(Number(dailyWorkerCountStr)) : null,
      externalProviderName: String(formData.get("externalProviderName") ?? "").trim() || null,
      externalProviderQuantity: externalProviderQuantityStr ? Number(externalProviderQuantityStr) : null,
      externalProviderUnitPrice: externalProviderUnitPriceStr ? Math.round(Number(externalProviderUnitPriceStr)) : null,
    },
  });

  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}

export async function deleteWorkTypeEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportWorkTypeEntry.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}

export async function addMaterialEntryAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
    return;
  }
  const dailyQuantityStr = String(formData.get("dailyQuantity") ?? "").trim();
  const sortOrder = await prisma.dailyReportMaterialEntry.count({ where: { dailyReportId } });

  await prisma.dailyReportMaterialEntry.create({
    data: {
      dailyReportId,
      sortOrder,
      name,
      spec: String(formData.get("spec") ?? "").trim() || null,
      unit: String(formData.get("unit") ?? "").trim() || null,
      dailyQuantity: dailyQuantityStr ? Number(dailyQuantityStr) : null,
      inspectionResult: String(formData.get("inspectionResult") ?? "").trim() || null,
      supplierName: String(formData.get("supplierName") ?? "").trim() || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
    },
  });

  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}

export async function deleteMaterialEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportMaterialEntry.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}

export async function addMachineryEntryAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  const machineType = String(formData.get("machineType") ?? "").trim();
  if (!machineType) {
    revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
    return;
  }
  const dailyCountStr = String(formData.get("dailyCount") ?? "").trim();
  const sortOrder = await prisma.dailyReportMachineryEntry.count({ where: { dailyReportId } });

  await prisma.dailyReportMachineryEntry.create({
    data: {
      dailyReportId,
      sortOrder,
      machineType,
      spec: String(formData.get("spec") ?? "").trim() || null,
      operatorName: String(formData.get("operatorName") ?? "").trim() || null,
      dailyCount: dailyCountStr ? Number(dailyCountStr) : null,
    },
  });

  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}

export async function deleteMachineryEntryAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  await assertOwnedReport(dailyReportId, user.companyId);

  await prisma.dailyReportMachineryEntry.delete({ where: { id } });
  revalidatePath(`/daily-reports/${dailyReportId}/nippondoro`);
}
