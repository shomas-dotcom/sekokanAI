-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "rateMasterItemId" TEXT;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_rateMasterItemId_fkey" FOREIGN KEY ("rateMasterItemId") REFERENCES "RateMasterItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

