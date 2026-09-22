-- CreateEnum
CREATE TYPE "DailyReportFormat" AS ENUM ('STANDARD', 'NIPPON_DORO_KOCHO');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "reportFormat" "DailyReportFormat" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "siteAbbreviation" TEXT;

-- CreateTable
CREATE TABLE "DailyReportWorkTypeEntry" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "workType" TEXT NOT NULL,
    "subItem" TEXT,
    "workArea" TEXT,
    "unit" TEXT,
    "dailyQuantity" DOUBLE PRECISION,
    "dailyWorkerCount" INTEGER,
    "externalProviderName" TEXT,
    "externalProviderQuantity" DOUBLE PRECISION,
    "externalProviderUnitPrice" INTEGER,

    CONSTRAINT "DailyReportWorkTypeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportMaterialEntry" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT,
    "dailyQuantity" DOUBLE PRECISION,
    "inspectionResult" TEXT,
    "supplierName" TEXT,
    "remarks" TEXT,

    CONSTRAINT "DailyReportMaterialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportMachineryEntry" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "machineType" TEXT NOT NULL,
    "spec" TEXT,
    "operatorName" TEXT,
    "dailyCount" DOUBLE PRECISION,

    CONSTRAINT "DailyReportMachineryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyReportWorkTypeEntry_dailyReportId_idx" ON "DailyReportWorkTypeEntry"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportMaterialEntry_dailyReportId_idx" ON "DailyReportMaterialEntry"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportMachineryEntry_dailyReportId_idx" ON "DailyReportMachineryEntry"("dailyReportId");

-- AddForeignKey
ALTER TABLE "DailyReportWorkTypeEntry" ADD CONSTRAINT "DailyReportWorkTypeEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterialEntry" ADD CONSTRAINT "DailyReportMaterialEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMachineryEntry" ADD CONSTRAINT "DailyReportMachineryEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
