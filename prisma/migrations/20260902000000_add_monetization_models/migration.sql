-- CreateEnum
CREATE TYPE "ProductSalesStatus" AS ENUM ('DRAFT', 'ON_SALE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "CompanyNoteType" AS ENUM ('MEETING', 'INQUIRY');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "pricingPlanId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" INTEGER NOT NULL,
    "setupFee" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "aiRunLimit" INTEGER,
    "storageLimitMb" INTEGER,
    "userLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetCustomer" TEXT,
    "price" INTEGER,
    "monthlyPrice" INTEGER,
    "setupFee" INTEGER,
    "featuresText" TEXT,
    "salesStatus" "ProductSalesStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyNoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE INDEX "CompanyNote_companyId_idx" ON "CompanyNote"("companyId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyNote" ADD CONSTRAINT "CompanyNote_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

