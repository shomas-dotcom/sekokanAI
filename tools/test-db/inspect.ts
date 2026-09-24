// 試験用DBの中身(日報の作業員明細・勤怠・出面の件数と内容)を表示する。画面確認の答え合わせ用。
// 実行: npx tsx tools/test-db/inspect.ts
import { prisma } from "../../src/lib/prisma";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error("DATABASE_URL が試験用(127.0.0.1)ではないため中止しました。");
  }
  const workers = await prisma.dailyReportWorker.findMany({
    select: { workerName: true, startTime: true, endTime: true, breakMinutes: true, workMinutes: true, dailyReportId: true },
  });
  const attendance = await prisma.attendance.findMany({
    select: { employeeId: true, targetDate: true, actualWorkMinutes: true, breakMinutes: true, remarks: true, status: true },
  });
  const siteAttendance = await prisma.siteAttendance.findMany({
    select: { workerName: true, projectId: true, workMinutes: true, status: true },
  });
  console.log(JSON.stringify({ workers, attendance, siteAttendance }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
