-- 会社ごとの見積Excel雛形登録機能。元のファイルを保存し、出力時は指定したセルだけ書き込む。
-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "fieldMappingJson" TEXT NOT NULL,
    "itemSheetName" TEXT NOT NULL,
    "itemStartRow" INTEGER NOT NULL,
    "itemMaxRows" INTEGER NOT NULL,
    "itemColumnsJson" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "templateVersionId" TEXT;

-- CreateIndex
CREATE INDEX "QuoteTemplate_companyId_idx" ON "QuoteTemplate"("companyId");

-- CreateIndex
CREATE INDEX "QuoteTemplateVersion_templateId_idx" ON "QuoteTemplateVersion"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteTemplateVersion_templateId_versionNumber_key" ON "QuoteTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "Quote_templateVersionId_idx" ON "Quote"("templateVersionId");

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateVersion" ADD CONSTRAINT "QuoteTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "QuoteTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
