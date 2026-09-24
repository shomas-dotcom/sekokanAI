-- 出面に労務原価の単価・金額を追加する(調査報告F10: 原価と請求単価の分離)。
-- 列の追加のみ。既存データは変更しない(既存の人工単価から自動で埋めない)。
ALTER TABLE "SiteAttendance" ADD COLUMN "laborCostUnitPrice" INTEGER;
ALTER TABLE "SiteAttendance" ADD COLUMN "laborCostAmount" INTEGER;