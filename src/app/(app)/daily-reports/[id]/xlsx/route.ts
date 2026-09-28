import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildDailyReportXlsxFromTemplate,
  DailyReportTemplateTooManyWorkersError,
  type DailyReportXlsxInput,
} from "@/lib/xlsx/dailyReportTemplateXlsx";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: true,
      company: true,
      workers: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) {
    return NextResponse.json({ error: "日報が見つかりません。" }, { status: 404 });
  }

  // 会社の雛形が1件も無ければ、標準出力(印刷/PDF)以外にExcel出力の手段が無い
  // (見積のような従来のExcel標準形式が日報には元々無いため、雛形を選ばないと出力できない)。
  let templateVersionId = report.templateVersionId;
  const requestedTemplateVersionId = new URL(request.url).searchParams.get("templateVersionId");
  if (!templateVersionId && requestedTemplateVersionId) {
    const requested = await prisma.dailyReportTemplateVersion.findFirst({
      where: { id: requestedTemplateVersionId, template: { companyId: user.companyId } },
    });
    if (requested && requested.workerMaxRows > 0) {
      await prisma.dailyReport.update({ where: { id: report.id }, data: { templateVersionId: requested.id } });
      templateVersionId = requested.id;
    }
  }
  if (!templateVersionId) {
    return NextResponse.json({ error: "書式(雛形)を選んでください。" }, { status: 400 });
  }

  const version = await prisma.dailyReportTemplateVersion.findUnique({ where: { id: templateVersionId } });
  if (!version) {
    return NextResponse.json({ error: "指定された雛形が見つかりません。" }, { status: 404 });
  }

  const xlsxInput: DailyReportXlsxInput = {
    companyName: report.company.name,
    projectName: report.project.name,
    siteAddress: report.project.siteAddress,
    reportDateText: report.reportDate.toLocaleDateString("ja-JP"),
    weather: report.weather,
    foremanName: report.foremanName,
    workerCount: report.workerCount,
    startTime: report.startTime,
    endTime: report.endTime,
    breakMinutes: report.breakMinutes,
    workContent: report.workContent,
    machinery: report.machinery,
    vehicles: report.vehicles,
    materials: report.materials,
    subcontractors: report.subcontractors,
    quantityWorked: report.quantityWorked,
    safetyNotes: report.safetyNotes,
    dangerPrediction: report.dangerPrediction,
    nextDayPlan: report.nextDayPlan,
    issues: report.issues,
    remarks: report.remarks,
    workers: report.workers.map((w) => ({
      workerName: w.workerName,
      role: w.role,
      startTime: w.startTime,
      endTime: w.endTime,
      workDescription: w.workDescription,
      manDays: w.manDays,
    })),
  };

  let buffer;
  try {
    buffer = await buildDailyReportXlsxFromTemplate(
      {
        fileData: Buffer.from(version.fileData),
        sheetName: version.sheetName,
        fieldMappingJson: version.fieldMappingJson,
        workerSheetName: version.workerSheetName,
        workerStartRow: version.workerStartRow,
        workerMaxRows: version.workerMaxRows,
        workerColumnsJson: version.workerColumnsJson,
      },
      xlsxInput
    );
  } catch (error) {
    if (error instanceof DailyReportTemplateTooManyWorkersError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const filename = `日報_${report.reportDate.toLocaleDateString("ja-JP")}_${report.project.name}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
