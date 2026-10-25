-- 日報かんたん入力(作業内容・使用機械・労務・KYをタップで選ぶ入力画面)用の追加。
-- 列の追加と新しい表の作成のみで、既存の行・列は変更も削除もしない。
-- 追加する列はすべて初期値つき(または空欄可)のため、既存の日報・作業員・設定はそのまま使える。

-- CreateEnum
CREATE TYPE "MachineOwnership" AS ENUM ('OWN', 'RENTAL');

-- CreateEnum
CREATE TYPE "MachinePriceUnit" AS ENUM ('DAY', 'HOUR');

-- CreateEnum
CREATE TYPE "LaborCategory" AS ENUM ('OWN_EMPLOYEE', 'FOREMAN', 'OPERATOR', 'SUBCONTRACT_WORKER', 'SUPPORT_WORKER', 'OTHER');

-- AlterTable
ALTER TABLE "WorkItemMaster" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultUnit" TEXT;

-- AlterTable
ALTER TABLE "DailyReportWorker" ADD COLUMN     "laborCategory" "LaborCategory",
ADD COLUMN     "affiliation" TEXT,
ADD COLUMN     "headcount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "CompanyWorkSettings" ADD COLUMN     "manDayBaseMinutes" INTEGER NOT NULL DEFAULT 480,
ADD COLUMN     "dailyMastersSeededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MachineMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownership" "MachineOwnership" NOT NULL DEFAULT 'OWN',
    "unitPrice" INTEGER,
    "priceUnit" "MachinePriceUnit" NOT NULL DEFAULT 'DAY',
    "includesOperator" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborCategoryRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "LaborCategory" NOT NULL,
    "dailyUnitPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborCategoryRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLaborRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dailyUnitPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLaborRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KyHazardMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "measuresJson" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KyHazardMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportWorkEntry" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "workItemId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "workMinutes" INTEGER,
    "remarks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReportWorkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportMachineUsage" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "machineId" TEXT,
    "name" TEXT NOT NULL,
    "ownership" "MachineOwnership" NOT NULL DEFAULT 'OWN',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "usageValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "priceUnit" "MachinePriceUnit" NOT NULL DEFAULT 'DAY',
    "includesOperator" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" INTEGER,
    "amount" INTEGER,
    "siteExpenseEntryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReportMachineUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportKyEntry" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "hazardId" TEXT,
    "label" TEXT NOT NULL,
    "measuresJson" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyReportKyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineMaster_companyId_idx" ON "MachineMaster"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "LaborCategoryRate_companyId_category_key" ON "LaborCategoryRate"("companyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLaborRate_employeeId_key" ON "EmployeeLaborRate"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLaborRate_companyId_idx" ON "EmployeeLaborRate"("companyId");

-- CreateIndex
CREATE INDEX "KyHazardMaster_companyId_idx" ON "KyHazardMaster"("companyId");

-- CreateIndex
CREATE INDEX "DailyReportWorkEntry_dailyReportId_idx" ON "DailyReportWorkEntry"("dailyReportId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportMachineUsage_siteExpenseEntryId_key" ON "DailyReportMachineUsage"("siteExpenseEntryId");

-- CreateIndex
CREATE INDEX "DailyReportMachineUsage_dailyReportId_idx" ON "DailyReportMachineUsage"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportKyEntry_dailyReportId_idx" ON "DailyReportKyEntry"("dailyReportId");

-- AddForeignKey
ALTER TABLE "MachineMaster" ADD CONSTRAINT "MachineMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborCategoryRate" ADD CONSTRAINT "LaborCategoryRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLaborRate" ADD CONSTRAINT "EmployeeLaborRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLaborRate" ADD CONSTRAINT "EmployeeLaborRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KyHazardMaster" ADD CONSTRAINT "KyHazardMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorkEntry" ADD CONSTRAINT "DailyReportWorkEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorkEntry" ADD CONSTRAINT "DailyReportWorkEntry_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItemMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMachineUsage" ADD CONSTRAINT "DailyReportMachineUsage_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMachineUsage" ADD CONSTRAINT "DailyReportMachineUsage_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "MachineMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMachineUsage" ADD CONSTRAINT "DailyReportMachineUsage_siteExpenseEntryId_fkey" FOREIGN KEY ("siteExpenseEntryId") REFERENCES "SiteExpenseEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportKyEntry" ADD CONSTRAINT "DailyReportKyEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportKyEntry" ADD CONSTRAINT "DailyReportKyEntry_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "KyHazardMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
