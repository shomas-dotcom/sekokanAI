import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listWorkbookSheets, buildSheetPreview } from "@/lib/xlsx/sheetPreview";
import { parseFieldMapping, parseWorkerColumns } from "@/lib/xlsx/dailyReportTemplateFields";
import { DailyReportTemplateMappingEditor } from "./DailyReportTemplateMappingEditor";

const MAX_PREVIEWED_SHEETS = 10;

export default async function DailyReportTemplateMappingPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id, versionId } = await params;
  const admin = await requireAdmin();
  const template = await prisma.dailyReportTemplate.findFirst({ where: { id, companyId: admin.companyId } });
  if (!template) notFound();
  const version = await prisma.dailyReportTemplateVersion.findFirst({ where: { id: versionId, templateId: id } });
  if (!version) notFound();

  const fileData = Buffer.from(version.fileData);
  const sheets = await listWorkbookSheets(fileData);
  const sheetNames = sheets.slice(0, MAX_PREVIEWED_SHEETS).map((s) => s.name);
  const previews = Object.fromEntries(
    await Promise.all(sheetNames.map(async (name) => [name, await buildSheetPreview(fileData, name)] as const))
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">位置合わせ: {template.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          <Link href={`/settings/daily-report-templates/${template.id}`} className="hover:underline">
            ← 雛形の詳細へ戻る
          </Link>
          (v{version.versionNumber} / {version.fileName})
        </p>
      </div>

      <DailyReportTemplateMappingEditor
        templateId={template.id}
        versionId={version.id}
        sheetNames={sheetNames}
        previews={previews}
        initialCoverSheetName={version.sheetName}
        initialWorkerSheetName={version.workerSheetName}
        initialFieldMapping={parseFieldMapping(version.fieldMappingJson)}
        initialWorkerColumns={parseWorkerColumns(version.workerColumnsJson)}
        initialWorkerStartRow={version.workerStartRow}
        initialWorkerMaxRows={version.workerMaxRows}
      />
    </div>
  );
}
