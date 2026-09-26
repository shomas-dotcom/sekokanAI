-- 勤務区分に「出張」「移動日」を追加する。既存データ・既存の値の意味は変更しない(列の追加なし)。
ALTER TYPE "WorkCategory" ADD VALUE 'BUSINESS_TRIP';
ALTER TYPE "WorkCategory" ADD VALUE 'TRAVEL_DAY';
