import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { changeDailyReportDate } from "@/lib/dailyReport/changeDate";

// 日報の日付を変えたとき、その日報から作られた勤怠・出面・機械の経費が同じ日へ動くこと、
// 動かせないとき(承認済み等)は何も変わらないことを確認する結合テスト。
// このテストが作った会社(名前が「日付変更テスト」で始まるもの)だけを終了後に削除する。
const TEST_COMPANY_PREFIX = "日付変更テスト株式会社";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

const D1 = new Date("2026-10-01");
const D2 = new Date("2026-10-05");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function setup() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-${suffix}` } });
  const user = await prisma.user.create({
    data: { companyId: company.id, email: `date-test-${suffix}@example.invalid`, name: "テスト利用者" },
  });
  const employee = await prisma.employee.create({ data: { companyId: company.id, name: "テスト太郎" } });
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: "テスト顧客" } });
  const project = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "テスト現場" },
  });
  const report = await prisma.dailyReport.create({
    data: { companyId: company.id, projectId: project.id, reportDate: D1 },
  });
  return { company, user, employee, project, report };
}

async function addLinkedWorker(
  ctx: Awaited<ReturnType<typeof setup>>,
  options: { siteStatus?: "DRAFT" | "SUBMITTED" | "APPROVED"; attendanceStatus?: "DRAFT" | "SUBMITTED" } = {}
) {
  const clockIn = new Date(D1.getTime() + (8 - 9) * 60 * 60 * 1000); // 8:00(日本時間)
  const clockOut = new Date(D1.getTime() + (17 - 9) * 60 * 60 * 1000);
  const attendance = await prisma.attendance.create({
    data: {
      companyId: ctx.company.id,
      employeeId: ctx.employee.id,
      targetDate: D1,
      clockInTime: clockIn,
      clockOutTime: clockOut,
      status: options.attendanceStatus ?? "DRAFT",
      createdByUserId: ctx.user.id,
    },
  });
  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      companyId: ctx.company.id,
      targetDate: D1,
      projectId: ctx.project.id,
      sourceDailyReportId: ctx.report.id,
      employeeId: ctx.employee.id,
      workerName: "テスト太郎",
      startTime: clockIn,
      endTime: clockOut,
      manDays: 1,
      status: options.siteStatus ?? "SUBMITTED",
      createdByUserId: ctx.user.id,
    },
  });
  const worker = await prisma.dailyReportWorker.create({
    data: {
      companyId: ctx.company.id,
      dailyReportId: ctx.report.id,
      employeeId: ctx.employee.id,
      workerName: "テスト太郎",
      attendanceId: attendance.id,
      siteAttendanceId: siteAttendance.id,
    },
  });
  return { attendance, siteAttendance, worker, clockIn, clockOut };
}

describe("日報の日付変更", () => {
  it("日報・勤怠・出面・機械の経費がそろって新しい日に動き、時刻も同じ日数ぶんずれる", async () => {
    const ctx = await setup();
    const { attendance, siteAttendance, clockIn } = await addLinkedWorker(ctx);
    const expense = await prisma.siteExpenseEntry.create({
      data: {
        companyId: ctx.company.id,
        targetDate: D1,
        projectId: ctx.project.id,
        sourceDailyReportId: ctx.report.id,
        category: "MACHINERY",
        name: "0.25㎥バックホー",
        createdByUserId: ctx.user.id,
      },
    });
    await prisma.dailyReportMachineUsage.create({
      data: { dailyReportId: ctx.report.id, name: "0.25㎥バックホー", siteExpenseEntryId: expense.id },
    });

    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D2 })
    );
    expect(result).toMatchObject({ ok: true, changed: true, movedSiteAttendances: 1, movedAttendances: 1, movedExpenses: 1 });

    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: ctx.report.id } });
    expect(report.reportDate.getTime()).toBe(D2.getTime());
    const sa = await prisma.siteAttendance.findUniqueOrThrow({ where: { id: siteAttendance.id } });
    expect(sa.targetDate.getTime()).toBe(D2.getTime());
    expect(sa.startTime?.getTime()).toBe(clockIn.getTime() + 4 * ONE_DAY_MS);
    const att = await prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } });
    expect(att.targetDate.getTime()).toBe(D2.getTime());
    expect(att.clockInTime?.getTime()).toBe(clockIn.getTime() + 4 * ONE_DAY_MS);
    const exp = await prisma.siteExpenseEntry.findUniqueOrThrow({ where: { id: expense.id } });
    expect(exp.targetDate.getTime()).toBe(D2.getTime());
  });

  it("同じ日付を指定したときは何も変えない", async () => {
    const ctx = await setup();
    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D1 })
    );
    expect(result).toMatchObject({ ok: true, changed: false });
  });

  it("出面が承認済みなら、日報も出面も動かさず理由を返す", async () => {
    const ctx = await setup();
    const { siteAttendance } = await addLinkedWorker(ctx, { siteStatus: "APPROVED" });

    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D2 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("承認済み");

    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: ctx.report.id } });
    expect(report.reportDate.getTime()).toBe(D1.getTime());
    const sa = await prisma.siteAttendance.findUniqueOrThrow({ where: { id: siteAttendance.id } });
    expect(sa.targetDate.getTime()).toBe(D1.getTime());
  });

  it("勤怠が提出済みなら動かさない", async () => {
    const ctx = await setup();
    await addLinkedWorker(ctx, { attendanceStatus: "SUBMITTED" });
    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D2 })
    );
    expect(result.ok).toBe(false);
  });

  it("勤怠が同じ日の別の日報とまとめられているときは動かさない", async () => {
    const ctx = await setup();
    const { attendance } = await addLinkedWorker(ctx);
    const otherReport = await prisma.dailyReport.create({
      data: { companyId: ctx.company.id, projectId: ctx.project.id, reportDate: D1 },
    });
    await prisma.dailyReportWorker.create({
      data: {
        companyId: ctx.company.id,
        dailyReportId: otherReport.id,
        employeeId: ctx.employee.id,
        workerName: "テスト太郎",
        attendanceId: attendance.id,
      },
    });
    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D2 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("別の日報");
  });

  it("変更先の日に同じ人の勤怠がすでにあるときは動かさない", async () => {
    const ctx = await setup();
    await addLinkedWorker(ctx);
    await prisma.attendance.create({
      data: { companyId: ctx.company.id, employeeId: ctx.employee.id, targetDate: D2, createdByUserId: ctx.user.id },
    });
    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: ctx.company.id, newDate: D2 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("すでに勤怠");
  });

  it("他の会社の日報は動かせない(会社ごとにデータが分かれている)", async () => {
    const ctx = await setup();
    const other = await setup();
    const result = await prisma.$transaction((tx) =>
      changeDailyReportDate(tx, { dailyReportId: ctx.report.id, companyId: other.company.id, newDate: D2 })
    );
    expect(result).toEqual({ ok: false, error: "日報が見つかりません。" });
    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: ctx.report.id } });
    expect(report.reportDate.getTime()).toBe(D1.getTime());
  });
});
