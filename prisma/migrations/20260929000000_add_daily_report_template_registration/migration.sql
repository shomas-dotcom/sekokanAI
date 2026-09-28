-- 会社ごとの日報Excel雛形登録機能。見積のQuoteTemplate/QuoteTemplateVersionと同じ考え方。
-- CreateTable
CREATE TABLE "DailyReportTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "fieldMappingJson" TEXT NOT NULL,
    "workerSheetName" TEXT NOT NULL,
    "workerStartRow" INTEGER NOT NULL,
    "workerMaxRows" INTEGER NOT NULL,
    "workerColumnsJson" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "templateVersionId" TEXT;

-- CreateIndex
CREATE INDEX "DailyReportTemplate_companyId_idx" ON "DailyReportTemplate"("companyId");

-- CreateIndex
CREATE INDEX "DailyReportTemplateVersion_templateId_idx" ON "DailyReportTemplateVersion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportTemplateVersion_templateId_versionNumber_key" ON "DailyReportTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "DailyReport_templateVersionId_idx" ON "DailyReport"("templateVersionId");

-- AddForeignKey
ALTER TABLE "DailyReportTemplate" ADD CONSTRAINT "DailyReportTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportTemplateVersion" ADD CONSTRAINT "DailyReportTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DailyReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DailyReportTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
