-- AlterTable
ALTER TABLE "Company" ADD COLUMN "targetGrossProfitRate" REAL;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN "costCategory" TEXT;

-- CreateTable
CREATE TABLE "RateMasterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RateMasterItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RateMasterItem_companyId_idx" ON "RateMasterItem"("companyId");
