-- 公開前修正①「30社限定・登録から6か月無料」。既存の有料契約(plan/subscriptionStatus)とは
-- 別に管理する。列の追加・新テーブルのみで、既存データへの影響はない。
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "isMonitor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monitorEnrolledAt" TIMESTAMP(3),
ADD COLUMN     "monitorFreeMonths" INTEGER;

-- CreateTable
CREATE TABLE "MonitorProgram" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "freeMonths" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorProgram_pkey" PRIMARY KEY ("id")
);
