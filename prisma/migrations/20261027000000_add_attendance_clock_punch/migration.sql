-- 勤怠ページの出退勤ボタン(打刻)用の追加。
-- 列の追加のみで、既存の行・列は変更も削除もしない。追加する列は空欄可・初期値つきのため、既存の勤怠はそのまま使える。

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "clockInPunched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clockOutPunched" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Attendance_projectId_idx" ON "Attendance"("projectId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
