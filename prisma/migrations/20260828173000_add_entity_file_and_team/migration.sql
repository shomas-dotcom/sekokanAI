-- CreateEnum
CREATE TYPE "FileEntityType" AS ENUM ('CUSTOMER', 'QUOTE', 'CONTRACT', 'INVOICE', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "EntityFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" "FileEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityFile_companyId_idx" ON "EntityFile"("companyId");

-- CreateIndex
CREATE INDEX "EntityFile_entityType_entityId_idx" ON "EntityFile"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "EntityFile" ADD CONSTRAINT "EntityFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

