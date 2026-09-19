-- CreateEnum
CREATE TYPE "TimeRoundingUnit" AS ENUM ('NONE', 'ROUND_5MIN', 'ROUND_10MIN', 'ROUND_15MIN', 'ROUND_30MIN');

-- CreateEnum
CREATE TYPE "OvertimeCalcMethod" AS ENUM ('DAILY_EIGHT_HOURS', 'SCHEDULED_HOURS');

-- CreateEnum
CREATE TYPE "WorkCategory" AS ENUM ('NORMAL', 'HOLIDAY_WORK', 'PAID_LEAVE', 'HALF_DAY_LEAVE', 'ABSENCE', 'LATE', 'EARLY_LEAVE');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ManDayUnit" AS ENUM ('QUARTER', 'HALF', 'THREE_QUARTER', 'FULL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SiteExpenseCategory" AS ENUM ('VEHICLE', 'MACHINERY', 'MATERIAL', 'TRANSPORT', 'TRAVEL_EXPENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "TimesheetEntityType" AS ENUM ('ATTENDANCE', 'SITE_ATTENDANCE');

-- CreateEnum
CREATE TYPE "TimesheetChangeType" AS ENUM ('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'CLOSE', 'REOPEN');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SITE_MANAGER';

-- CreateTable
CREATE TABLE "ProjectSupervisor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyWorkSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "scheduledStartTime" TEXT NOT NULL DEFAULT '08:00',
    "scheduledEndTime" TEXT NOT NULL DEFAULT '17:00',
    "scheduledBreakMinutes" INTEGER NOT NULL DEFAULT 120,
    "scheduledWorkMinutes" INTEGER NOT NULL DEFAULT 480,
    "closingDay" INTEGER NOT NULL DEFAULT 31,
    "holidayWeekdaysJson" TEXT NOT NULL DEFAULT '[0]',
    "overtimeCalcMethod" "OvertimeCalcMethod" NOT NULL DEFAULT 'DAILY_EIGHT_HOURS',
    "nightShiftStartTime" TEXT NOT NULL DEFAULT '22:00',
    "nightShiftEndTime" TEXT NOT NULL DEFAULT '05:00',
    "timeRounding" "TimeRoundingUnit" NOT NULL DEFAULT 'NONE',
    "amountRoundingMode" "RoundingMode" NOT NULL DEFAULT 'ROUND',
    "maxManDaysPerDay" DOUBLE PRECISION,
    "autoCreateAttendanceFromDailyReport" BOOLEAN NOT NULL DEFAULT true,
    "attendanceApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "siteAttendanceApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyWorkSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "clockInTime" TIMESTAMP(3),
    "clockOutTime" TIMESTAMP(3),
    "siteArrivalTime" TIMESTAMP(3),
    "siteDepartureTime" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualWorkMinutes" INTEGER,
    "normalWorkMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "nightShiftMinutes" INTEGER,
    "holidayWorkMinutes" INTEGER,
    "workCategory" "WorkCategory" NOT NULL DEFAULT 'NORMAL',
    "isPaidLeave" BOOLEAN NOT NULL DEFAULT false,
    "isAbsence" BOOLEAN NOT NULL DEFAULT false,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isEarlyLeave" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "sourceDailyReportId" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAttendance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDailyReportId" TEXT,
    "employeeId" TEXT,
    "workerName" TEXT NOT NULL,
    "jobType" TEXT,
    "workContent" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "workMinutes" INTEGER,
    "manDayUnit" "ManDayUnit" NOT NULL DEFAULT 'FULL',
    "manDays" DOUBLE PRECISION NOT NULL,
    "manDayUnitPrice" INTEGER,
    "amount" INTEGER,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isCostTarget" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteExpenseEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceDailyReportId" TEXT,
    "rateMasterItemId" TEXT,
    "category" "SiteExpenseCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "usageHours" DOUBLE PRECISION,
    "unit" TEXT,
    "unitPrice" INTEGER,
    "amount" INTEGER,
    "dispatchFee" INTEGER,
    "tollFee" INTEGER,
    "parkingFee" INTEGER,
    "otherFee" INTEGER,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isCostTarget" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteExpenseEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetChangeLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "TimesheetEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" "TimesheetChangeType" NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "reason" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSupervisor_projectId_idx" ON "ProjectSupervisor"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSupervisor_userId_idx" ON "ProjectSupervisor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSupervisor_projectId_userId_key" ON "ProjectSupervisor"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWorkSettings_companyId_key" ON "CompanyWorkSettings"("companyId");

-- CreateIndex
CREATE INDEX "Attendance_companyId_idx" ON "Attendance"("companyId");

-- CreateIndex
CREATE INDEX "Attendance_companyId_targetDate_idx" ON "Attendance"("companyId", "targetDate");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_targetDate_key" ON "Attendance"("employeeId", "targetDate");

-- CreateIndex
CREATE INDEX "SiteAttendance_companyId_idx" ON "SiteAttendance"("companyId");

-- CreateIndex
CREATE INDEX "SiteAttendance_companyId_targetDate_idx" ON "SiteAttendance"("companyId", "targetDate");

-- CreateIndex
CREATE INDEX "SiteAttendance_projectId_idx" ON "SiteAttendance"("projectId");

-- CreateIndex
CREATE INDEX "SiteAttendance_employeeId_idx" ON "SiteAttendance"("employeeId");

-- CreateIndex
CREATE INDEX "SiteExpenseEntry_companyId_idx" ON "SiteExpenseEntry"("companyId");

-- CreateIndex
CREATE INDEX "SiteExpenseEntry_companyId_targetDate_idx" ON "SiteExpenseEntry"("companyId", "targetDate");

-- CreateIndex
CREATE INDEX "SiteExpenseEntry_projectId_idx" ON "SiteExpenseEntry"("projectId");

-- CreateIndex
CREATE INDEX "TimesheetChangeLog_companyId_idx" ON "TimesheetChangeLog"("companyId");

-- CreateIndex
CREATE INDEX "TimesheetChangeLog_entityType_entityId_idx" ON "TimesheetChangeLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ProjectSupervisor" ADD CONSTRAINT "ProjectSupervisor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSupervisor" ADD CONSTRAINT "ProjectSupervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyWorkSettings" ADD CONSTRAINT "CompanyWorkSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sourceDailyReportId_fkey" FOREIGN KEY ("sourceDailyReportId") REFERENCES "DailyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_sourceDailyReportId_fkey" FOREIGN KEY ("sourceDailyReportId") REFERENCES "DailyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteExpenseEntry" ADD CONSTRAINT "SiteExpenseEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteExpenseEntry" ADD CONSTRAINT "SiteExpenseEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteExpenseEntry" ADD CONSTRAINT "SiteExpenseEntry_sourceDailyReportId_fkey" FOREIGN KEY ("sourceDailyReportId") REFERENCES "DailyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteExpenseEntry" ADD CONSTRAINT "SiteExpenseEntry_rateMasterItemId_fkey" FOREIGN KEY ("rateMasterItemId") REFERENCES "RateMasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteExpenseEntry" ADD CONSTRAINT "SiteExpenseEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChangeLog" ADD CONSTRAINT "TimesheetChangeLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetChangeLog" ADD CONSTRAINT "TimesheetChangeLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
