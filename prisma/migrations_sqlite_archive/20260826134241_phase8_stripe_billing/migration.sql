-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "targetGrossProfitRate" REAL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "trialEndsAt" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Company" ("address", "bankAccountHolder", "bankAccountNumber", "bankAccountType", "bankBranch", "bankName", "closingDay", "createdAt", "defaultPaymentTerms", "defaultTaxRoundingMode", "email", "employeeCount", "fax", "id", "industry", "invoiceRegistrationNumber", "isSuspended", "licenseNumber", "logoUrl", "name", "phone", "plan", "postalCode", "representativeName", "suspendedAt", "suspendedReason", "targetGrossProfitRate", "updatedAt") SELECT "address", "bankAccountHolder", "bankAccountNumber", "bankAccountType", "bankBranch", "bankName", "closingDay", "createdAt", "defaultPaymentTerms", "defaultTaxRoundingMode", "email", "employeeCount", "fax", "id", "industry", "invoiceRegistrationNumber", "isSuspended", "licenseNumber", "logoUrl", "name", "phone", "plan", "postalCode", "representativeName", "suspendedAt", "suspendedReason", "targetGrossProfitRate", "updatedAt" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_stripeCustomerId_key" ON "Company"("stripeCustomerId");
CREATE UNIQUE INDEX "Company_stripeSubscriptionId_key" ON "Company"("stripeSubscriptionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "BillingEvent_companyId_idx" ON "BillingEvent"("companyId");
