-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "breakMinutes" INTEGER;
ALTER TABLE "DailyReport" ADD COLUMN "capturedAddress" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "dangerPrediction" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "endTime" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "foremanName" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "latitude" REAL;
ALTER TABLE "DailyReport" ADD COLUMN "longitude" REAL;
ALTER TABLE "DailyReport" ADD COLUMN "materials" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "overtimeMinutes" INTEGER;
ALTER TABLE "DailyReport" ADD COLUMN "remarks" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "startTime" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "subcontractors" TEXT;
ALTER TABLE "DailyReport" ADD COLUMN "vehicles" TEXT;

-- CreateTable
CREATE TABLE "DailyReportPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "takenAt" DATETIME,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyReportPhoto_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyReportLaborEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "workerName" TEXT NOT NULL,
    "unitPrice" INTEGER,
    "overtimeHours" REAL,
    "jobType" TEXT,
    CONSTRAINT "DailyReportLaborEntry_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyReportOwnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "amount" INTEGER,
    CONSTRAINT "DailyReportOwnItem_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyReportPartnerItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyReportId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "quantity" TEXT,
    "unitPrice" INTEGER,
    CONSTRAINT "DailyReportPartnerItem_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkItemMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkItemMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyReportPhoto_dailyReportId_idx" ON "DailyReportPhoto"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportPhoto_companyId_idx" ON "DailyReportPhoto"("companyId");

-- CreateIndex
CREATE INDEX "DailyReportLaborEntry_dailyReportId_idx" ON "DailyReportLaborEntry"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportOwnItem_dailyReportId_idx" ON "DailyReportOwnItem"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportPartnerItem_dailyReportId_idx" ON "DailyReportPartnerItem"("dailyReportId");

-- CreateIndex
CREATE INDEX "WorkItemMaster_companyId_idx" ON "WorkItemMaster"("companyId");
