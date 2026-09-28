-- AI利用回数の上限を守るための予約状態(RESERVED/DONE)を追加する(調査報告F13)。
-- 列の追加のみ。既存の行はすべてDONE(完了済み)になる。
ALTER TABLE "AiUsageLog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DONE';
