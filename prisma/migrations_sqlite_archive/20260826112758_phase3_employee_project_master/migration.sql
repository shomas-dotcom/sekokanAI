-- AlterTable
ALTER TABLE "Project" ADD COLUMN "primeContractorName" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'REGULAR',
    "hireDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeQualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeQualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "representativeName" TEXT,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "closingDay" INTEGER,
    "defaultPaymentTerms" TEXT,
    "defaultTaxRoundingMode" TEXT NOT NULL DEFAULT 'ROUND',
    "licenseNumber" TEXT,
    "invoiceRegistrationNumber" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolder" TEXT,
    "logoUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" DATETIME,
    "suspendedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Company" ("address", "bankAccountHolder", "bankAccountNumber", "bankAccountType", "bankBranch", "bankName", "createdAt", "email", "employeeCount", "fax", "id", "industry", "invoiceRegistrationNumber", "isSuspended", "licenseNumber", "logoUrl", "name", "phone", "plan", "postalCode", "representativeName", "suspendedAt", "suspendedReason", "updatedAt") SELECT "address", "bankAccountHolder", "bankAccountNumber", "bankAccountType", "bankBranch", "bankName", "createdAt", "email", "employeeCount", "fax", "id", "industry", "invoiceRegistrationNumber", "isSuspended", "licenseNumber", "logoUrl", "name", "phone", "plan", "postalCode", "representativeName", "suspendedAt", "suspendedReason", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeQualification_employeeId_idx" ON "EmployeeQualification"("employeeId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_employeeId_idx" ON "ProjectMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_employeeId_key" ON "ProjectMember"("projectId", "employeeId");
