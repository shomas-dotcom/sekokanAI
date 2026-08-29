-- CreateTable
CREATE TABLE "RateMasterPriceHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rateMasterItemId" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceQuoteId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateMasterPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateMasterPriceHistory_companyId_idx" ON "RateMasterPriceHistory"("companyId");

-- CreateIndex
CREATE INDEX "RateMasterPriceHistory_rateMasterItemId_idx" ON "RateMasterPriceHistory"("rateMasterItemId");

-- AddForeignKey
ALTER TABLE "RateMasterPriceHistory" ADD CONSTRAINT "RateMasterPriceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMasterPriceHistory" ADD CONSTRAINT "RateMasterPriceHistory_rateMasterItemId_fkey" FOREIGN KEY ("rateMasterItemId") REFERENCES "RateMasterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMasterPriceHistory" ADD CONSTRAINT "RateMasterPriceHistory_sourceQuoteId_fkey" FOREIGN KEY ("sourceQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

