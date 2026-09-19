-- CreateEnum
CREATE TYPE "DailyReportWorkerType" AS ENUM ('EMPLOYEE', 'PARTNER', 'SUBCONTRACTOR', 'MANUAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "DailyReportWorker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "employeeId" TEXT,
    "workerName" TEXT NOT NULL,
    "workerType" "DailyReportWorkerType" NOT NULL DEFAULT 'EMPLOYEE',
    "role" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "breakMinutes" INTEGER,
    "workMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "manDays" DOUBLE PRECISION,
    "workDescription" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "reflectToAttendance" BOOLEAN NOT NULL DEFAULT true,
    "reflectToSiteAttendance" BOOLEAN NOT NULL DEFAULT true,
    "attendanceId" TEXT,
    "siteAttendanceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportWorker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportWorker_siteAttendanceId_key" ON "DailyReportWorker"("siteAttendanceId");

-- CreateIndex
CREATE INDEX "DailyReportWorker_companyId_idx" ON "DailyReportWorker"("companyId");

-- CreateIndex
CREATE INDEX "DailyReportWorker_dailyReportId_idx" ON "DailyReportWorker"("dailyReportId");

-- CreateIndex
CREATE INDEX "DailyReportWorker_employeeId_idx" ON "DailyReportWorker"("employeeId");

-- CreateIndex
CREATE INDEX "DailyReportWorker_attendanceId_idx" ON "DailyReportWorker"("attendanceId");

-- CreateIndex
CREATE INDEX "User_employeeId_idx" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
