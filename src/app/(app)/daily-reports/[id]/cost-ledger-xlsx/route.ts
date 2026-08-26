import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCostLedgerXlsx } from "@/lib/xlsx/costLedgerXlsx";

/** 西暦の日付を元ファイルの表記(令和●年●月●日)に変換する */
function toReiwaText(date: Date): string {
  const reiwaStart = new Date(2019, 4, 1); // 令和元年5月1日
  const year = date.getFullYear() - 2018;
  const label = date >= reiwaStart ? `令和${year}年` : `${date.getFullYear()}年`;
  return `${label}${date.getMonth() + 1}月${date.getDate()}日`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: true,
      laborEntries: { orderBy: { sortOrder: "asc" } },
      ownItems: { orderBy: { sortOrder: "asc" } },
      partnerItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) {
    return NextResponse.json({ error: "日報が見つかりません。" }, { status: 404 });
  }

  // 累計金額: 元ファイルは別ファイルへの外部参照だったが、本システムでは同一案件の
  // 過去日報(当日より前の日付)の明細をDBから合計して算出する(costLedgerXlsx.ts参照)。
  const priorFilter = { dailyReport: { projectId: report.projectId, reportDate: { lt: report.reportDate } } };
  const [priorLabor, priorVehicles, priorMaterials, priorPartnerEquip, priorOtherExpense] = await Promise.all([
    prisma.dailyReportLaborEntry.aggregate({ where: priorFilter, _sum: { unitPrice: true } }),
    prisma.dailyReportOwnItem.aggregate({
      where: { ...priorFilter, kind: "VEHICLE_MACHINERY" },
      _sum: { amount: true },
    }),
    prisma.dailyReportOwnItem.aggregate({
      where: { ...priorFilter, kind: "MATERIAL" },
      _sum: { amount: true },
    }),
    prisma.dailyReportPartnerItem.aggregate({
      where: { ...priorFilter, kind: "PARTNER_EQUIPMENT" },
      _sum: { unitPrice: true },
    }),
    prisma.dailyReportPartnerItem.aggregate({
      where: { ...priorFilter, kind: "OTHER_EXPENSE" },
      _sum: { unitPrice: true },
    }),
  ]);
  const cumulativeAmountBeforeToday =
    (priorLabor._sum.unitPrice ?? 0) +
    (priorVehicles._sum.amount ?? 0) +
    (priorMaterials._sum.amount ?? 0) +
    (priorPartnerEquip._sum.unitPrice ?? 0) +
    (priorOtherExpense._sum.unitPrice ?? 0);

  const buffer = await buildCostLedgerXlsx({
    reportDateText: toReiwaText(report.reportDate),
    creatorName: user.name,
    projectName: report.project.name,
    cumulativeAmountBeforeToday,
    laborEntries: report.laborEntries,
    vehicles: report.ownItems
      .filter((i) => i.kind === "VEHICLE_MACHINERY")
      .map((i) => ({ name: i.name, quantity: i.quantity, amount: i.amount })),
    ownMaterials: report.ownItems
      .filter((i) => i.kind === "MATERIAL")
      .map((i) => ({ name: i.name, quantity: i.quantity, amount: i.amount })),
    partnerEquipment: report.partnerItems
      .filter((i) => i.kind === "PARTNER_EQUIPMENT")
      .map((i) => ({ name: i.name, quantity: i.quantity, amount: i.unitPrice })),
    otherExpenses: report.partnerItems
      .filter((i) => i.kind === "OTHER_EXPENSE")
      .map((i) => ({ name: i.name, quantity: i.quantity, amount: i.unitPrice })),
    workContent: report.workContent,
  });

  const filename = `原価集計表_${report.reportDate.toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
