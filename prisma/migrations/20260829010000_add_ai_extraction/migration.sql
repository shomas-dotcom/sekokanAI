-- CreateEnum
CREATE TYPE "AiDocumentType" AS ENUM ('BUSINESS_CARD', 'ESTIMATE_REQUEST', 'ESTIMATE', 'CONTRACT', 'INVOICE', 'EMPLOYEE_ID', 'PROJECT_MESSAGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AiExtractionStatus" AS ENUM ('PROCESSING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "AiExtraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "documentType" "AiDocumentType" NOT NULL,
    "status" "AiExtractionStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "sourceSummary" TEXT,
    "extractedJson" TEXT NOT NULL,
    "errorMessage" TEXT,
    "resultCustomerId" TEXT,
    "resultProjectId" TEXT,
    "resultEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AiExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiExtraction_companyId_idx" ON "AiExtraction"("companyId");

-- CreateIndex
CREATE INDEX "AiExtraction_companyId_status_idx" ON "AiExtraction"("companyId", "status");

-- AddForeignKey
ALTER TABLE "AiExtraction" ADD CONSTRAINT "AiExtraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

