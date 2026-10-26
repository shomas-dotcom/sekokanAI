import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { clockIn, clockOut } from "@/lib/timesheet/clock";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { reflectDailyReportWorker } from "@/lib/dailyReport/reflectWorker";

// 勤怠ページの出退勤ボタン(打刻)の結合テスト。
// このテストが作った会社(名前が「打刻テスト」で始まるもの)だけを終了後に削除する。
const TEST_COMPANY_PREFIX = "打刻テスト株式会社";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

async function setup() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-${suffix}` } });
  const other = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-他社-${suffix}` } });
  const employee = await prisma.employee.create({ data: { companyId: company.id, name: "打刻太郎" } });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `clock-${suffix}@example.invalid`,
      name: "打刻太郎",
      role: "MEMBER",
      employeeId: employee.id,
    },
  });
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: "顧客" } });
  const active = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "施工中の現場", status: "IN_PROGRESS" },
  });
  const completed = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "完工した現場", status: "COMPLETED" },
  });
  const otherCustomer = await prisma.customer.create({ data: { companyId: other.id, name: "他社顧客" } });
  const otherProject = await prisma.project.create({
    data: { companyId: other.id, customerId: otherCustomer.id, name: "他社の現場", status: "IN_PROGRESS" },
  });
  const actor = { userId: user.id, companyId: company.id, employeeId: employee.id };
  return { company, employee, user, active, completed, otherProject, actor };
}

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
}, 30000);

// JST 2026-10-05(月) 7:50 出勤 → 17:20 退勤
const IN = new Date("2026-10-04T22:50:00Z");
const OUT = new Date("2026-10-05T08:20:00Z");
const TARGET = new Date("2026-10-05"); // 日報と同じ形(その日のUTC 0時)

describe("打刻", () => {
  it("今の案件以外・他社の案件では出勤できない", async () => {
    expect((await clockIn(ctx.actor, ctx.completed.id, IN)).ok).toBe(false);
    expect((await clockIn(ctx.actor, ctx.otherProject.id, IN)).ok).toBe(false);
    expect(await prisma.attendance.count({ where: { employeeId: ctx.employee.id } })).toBe(0);
  });

  it("退勤は出勤のあとでないと押せない", async () => {
    const r = await clockOut(ctx.actor, OUT);
    expect(r.ok).toBe(false);
  });

  it("出勤→退勤で、時刻・現場・休憩・実働・残業が入る", async () => {
    const r1 = await clockIn(ctx.actor, ctx.active.id, IN);
    expect(r1).toMatchObject({ ok: true });
    expect((await clockIn(ctx.actor, ctx.active.id, IN)).ok).toBe(false); // 二度目は不可

    const r2 = await clockOut(ctx.actor, OUT);
    expect(r2).toMatchObject({ ok: true });
    expect((await clockOut(ctx.actor, OUT)).ok).toBe(false); // 二度目は不可

    const a = await prisma.attendance.findUniqueOrThrow({
      where: { employeeId_targetDate: { employeeId: ctx.employee.id, targetDate: TARGET } },
    });
    const settings = await getOrCreateWorkSettings(ctx.company.id);
    expect(a.projectId).toBe(ctx.active.id);
    expect(a.clockInTime?.toISOString()).toBe(IN.toISOString());
    expect(a.clockOutTime?.toISOString()).toBe(OUT.toISOString());
    expect(a.breakMinutes).toBe(settings.scheduledBreakMinutes);
    expect(a.actualWorkMinutes).toBe(570 - settings.scheduledBreakMinutes);
    expect(a.overtimeMinutes).toBe(Math.max(0, 570 - settings.scheduledBreakMinutes - settings.scheduledWorkMinutes));
    expect(a.clockInPunched && a.clockOutPunched).toBe(true);
  });

  it("あとから日報が反映されても、打刻の時刻は上書きしない", async () => {
    const report = await prisma.dailyReport.create({
      data: { companyId: ctx.company.id, projectId: ctx.active.id, reportDate: TARGET },
    });
    const worker = await prisma.dailyReportWorker.create({
      data: {
        companyId: ctx.company.id,
        dailyReportId: report.id,
        workerType: "EMPLOYEE",
        employeeId: ctx.employee.id,
        workerName: "打刻太郎",
        startTime: "08:00",
        endTime: "15:00",
        breakMinutes: 60,
        workMinutes: 360,
      },
    });
    const settings = await getOrCreateWorkSettings(ctx.company.id);
    await prisma.$transaction((tx) =>
      reflectDailyReportWorker(tx, worker.id, { id: ctx.user.id, companyId: ctx.company.id }, settings)
    );

    const a = await prisma.attendance.findUniqueOrThrow({
      where: { employeeId_targetDate: { employeeId: ctx.employee.id, targetDate: TARGET } },
    });
    expect(a.clockInTime?.toISOString()).toBe(IN.toISOString());
    expect(a.clockOutTime?.toISOString()).toBe(OUT.toISOString());
    expect(a.actualWorkMinutes).toBe(570 - settings.scheduledBreakMinutes);
  });

  it("提出済みの日は打刻できない", async () => {
    const nextIn = new Date("2026-10-05T22:50:00Z"); // JST 10/6
    await clockIn(ctx.actor, ctx.active.id, nextIn);
    await prisma.attendance.updateMany({
      where: { employeeId: ctx.employee.id, targetDate: new Date("2026-10-06") },
      data: { status: "SUBMITTED" },
    });
    expect((await clockOut(ctx.actor, new Date("2026-10-06T08:00:00Z"))).ok).toBe(false);
  });
});
