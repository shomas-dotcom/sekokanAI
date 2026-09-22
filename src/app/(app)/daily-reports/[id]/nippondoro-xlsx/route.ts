import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildNippondoroXlsx } from "@/lib/xlsx/nippondoroXlsx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: true,
      workTypeEntries: { orderBy: { sortOrder: "asc" } },
      materialEntries: { orderBy: { sortOrder: "asc" } },
      machineryEntries: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) {
    return NextResponse.json({ error: "日報が見つかりません。" }, { status: 404 });
  }
  if (report.project.reportFormat !== "NIPPON_DORO_KOCHO") {
    return NextResponse.json({ error: "この案件は日本道路指定様式ではありません。" }, { status: 400 });
  }

  const priorFilter = { projectId: report.projectId, reportDate: { lt: report.reportDate } };
  const [priorWorkTypeAgg, priorMaterialAgg, priorMachineryAgg] = await Promise.all([
    prisma.dailyReportWorkTypeEntry.groupBy({
      by: ["workType", "subItem"],
      where: { dailyReport: priorFilter },
      _sum: { dailyQuantity: true, dailyWorkerCount: true },
    }),
    prisma.dailyReportMaterialEntry.groupBy({
      by: ["name"],
      where: { dailyReport: priorFilter },
      _sum: { dailyQuantity: true },
    }),
    prisma.dailyReportMachineryEntry.groupBy({
      by: ["machineType", "spec"],
      where: { dailyReport: priorFilter },
      _sum: { dailyCount: true },
    }),
  ]);
  const cumulativeByWorkType = new Map(
    priorWorkTypeAgg.map((a) => [
      `${a.workType}::${a.subItem ?? ""}`,
      { quantity: a._sum.dailyQuantity ?? 0, workerCount: a._sum.dailyWorkerCount ?? 0 },
    ])
  );
  const cumulativeByMaterial = new Map(priorMaterialAgg.map((a) => [a.name, a._sum.dailyQuantity ?? 0]));
  const cumulativeByMachinery = new Map(
    priorMachineryAgg.map((a) => [`${a.machineType}::${a.spec ?? ""}`, a._sum.dailyCount ?? 0])
  );

  const buffer = await buildNippondoroXlsx({
    siteAbbreviation: report.project.siteAbbreviation,
    reportDate: report.reportDate,
    weather: report.weather,
    startTime: report.startTime,
    endTime: report.endTime,
    workTypes: report.workTypeEntries.map((e) => {
      const cum = cumulativeByWorkType.get(`${e.workType}::${e.subItem ?? ""}`);
      return {
        workType: e.workType,
        subItem: e.subItem,
        workArea: e.workArea,
        unit: e.unit,
        dailyQuantity: e.dailyQuantity,
        cumulativeQuantity: (cum?.quantity ?? 0) + (e.dailyQuantity ?? 0),
        dailyWorkerCount: e.dailyWorkerCount,
        cumulativeWorkerCount: (cum?.workerCount ?? 0) + (e.dailyWorkerCount ?? 0),
        externalProviderName: e.externalProviderName,
        externalProviderQuantity: e.externalProviderQuantity,
        externalProviderUnitPrice: e.externalProviderUnitPrice,
      };
    }),
    materials: report.materialEntries.map((e) => ({
      name: e.name,
      spec: e.spec,
      unit: e.unit,
      dailyQuantity: e.dailyQuantity,
      cumulativeQuantity: (cumulativeByMaterial.get(e.name) ?? 0) + (e.dailyQuantity ?? 0),
      inspectionResult: e.inspectionResult,
      supplierName: e.supplierName,
      remarks: e.remarks,
    })),
    machinery: report.machineryEntries.map((e) => ({
      machineType: e.machineType,
      spec: e.spec,
      operatorName: e.operatorName,
      dailyCount: e.dailyCount,
      cumulativeCount: (cumulativeByMachinery.get(`${e.machineType}::${e.spec ?? ""}`) ?? 0) + (e.dailyCount ?? 0),
    })),
  });

  const filename = `工事日報_${report.reportDate.toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
