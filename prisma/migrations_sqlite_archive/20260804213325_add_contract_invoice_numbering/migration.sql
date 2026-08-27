-- AlterTable
ALTER TABLE "Company" ADD COLUMN "bankAccountHolder" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccountType" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankBranch" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Company" ADD COLUMN "email" TEXT;
ALTER TABLE "Company" ADD COLUMN "fax" TEXT;
ALTER TABLE "Company" ADD COLUMN "invoiceRegistrationNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "postalCode" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "estimateNumber" TEXT;
ALTER TABLE "Quote" ADD COLUMN "expirationDate" DATETIME;

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NumberSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quoteId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "contractDate" DATETIME NOT NULL,
    "contractAmountExcludingTax" INTEGER NOT NULL,
    "taxRatePercent" INTEGER NOT NULL DEFAULT 10,
    "taxAmount" INTEGER NOT NULL,
    "contractAmountIncludingTax" INTEGER NOT NULL,
    "roundingMode" TEXT NOT NULL DEFAULT 'ROUND',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "paymentTerms" TEXT,
    "warrantyTerms" TEXT,
    "delayTerms" TEXT,
    "cancellationTerms" TEXT,
    "specialTerms" TEXT,
    "clausesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmedSnapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "billingType" TEXT NOT NULL DEFAULT 'FULL',
    "billingPercentage" REAL,
    "previousBilledAmount" INTEGER NOT NULL DEFAULT 0,
    "currentBilledAmount" INTEGER NOT NULL DEFAULT 0,
    "cumulativeBilledAmount" INTEGER NOT NULL DEFAULT 0,
    "remainingAmount" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "taxRatePercent" INTEGER NOT NULL DEFAULT 10,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "roundingMode" TEXT NOT NULL DEFAULT 'ROUND',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "issuedSnapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemName" TEXT NOT NULL,
    "spec" TEXT,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "remarks" TEXT,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectCode" TEXT,
    "name" TEXT NOT NULL,
    "siteAddress" TEXT,
    "orderingParty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "managerName" TEXT,
    "siteAgentName" TEXT,
    "chiefEngineerName" TEXT,
    "contractAmountExcludingTax" INTEGER,
    "taxRatePercent" INTEGER NOT NULL DEFAULT 10,
    "paymentTerms" TEXT,
    "overview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("companyId", "createdAt", "customerId", "endDate", "id", "name", "orderingParty", "siteAddress", "startDate", "status", "updatedAt") SELECT "companyId", "createdAt", "customerId", "endDate", "id", "name", "orderingParty", "siteAddress", "startDate", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
CREATE INDEX "Project_customerId_idx" ON "Project"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_companyId_docType_year_key" ON "NumberSequence"("companyId", "docType", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_companyId_idx" ON "Contract"("companyId");

-- CreateIndex
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_estimateNumber_key" ON "Quote"("estimateNumber");

