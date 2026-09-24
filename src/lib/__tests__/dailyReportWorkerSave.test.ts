import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 日報の作業員追加(調査報告 F07 二重登録・F08 一括保存)の模擬試験。
// DB・セッションは置き換えている。実DBでのトランザクションの取消し動作の代わりにはならない。

const session = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
const audit = vi.hoisted(() => ({ logAction: vi.fn() }));
const db = vi.hoisted(() => {
  const tx = {
    dailyReportWorker: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dailyReport: { update: vi.fn() },
    attendance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    siteAttendance: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      dailyReport: { findFirst: vi.fn() },
      employee: { findFirst: vi.fn() },
      companyWorkSettings: { findUnique: vi.fn(), create: vi.fn() },
      company: { update: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});

vi.mock("@/lib/session", () => ({ getSessionUser: async () => session.user, destroySession: async () => {} }));
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/audit", () => audit);
vi.mock("@/lib/ai", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const reportDate = new Date(Date.UTC(2026, 9, 1));

function form() {
  const fd = new FormData();
  fd.set("dailyReportId", "r1");
  fd.set("workerType", "EMPLOYEE");
  fd.set("employeeId", "emp1");
  fd.set("startTime", "08:00");
  fd.set("endTime", "17:00");
  fd.set("breakMinutes", "120");
  fd.set("reflectToAttendance", "on");
  fd.set("reflectToSiteAttendance", "on");
  return fd;
}

beforeAll(async () => {
  await import("@/app/(app)/daily-reports/actions");
}, 120_000);

beforeEach(() => {
  vi.clearAllMocks();
  session.user = {
    id: "u1",
    companyId: "c1",
    role: "ADMIN",
    name: "テスト",
    deletedAt: null,
    company: { id: "c1", isSuspended: false, subscriptionStatus: "active", plan: "PREMIUM", trialEndsAt: null },
  };
  db.prisma.dailyReport.findFirst.mockResolvedValue({ id: "r1", companyId: "c1", projectId: "p1", foremanName: null });
  db.prisma.employee.findFirst.mockResolvedValue({ id: "emp1", name: "田中", companyId: "c1" });
  db.prisma.companyWorkSettings.findUnique.mockResolvedValue({
    companyId: "c1",
    scheduledWorkMinutes: 480,
    nightShiftStartTime: "22:00",
    nightShiftEndTime: "05:00",
  });
  db.tx.dailyReportWorker.count.mockResolvedValue(0);
  db.tx.dailyReportWorker.create.mockResolvedValue({ id: "w1" });
  db.tx.dailyReportWorker.findUnique.mockResolvedValue({
    id: "w1",
    dailyReportId: "r1",
    employeeId: "emp1",
    workerName: "田中",
    role: null,
    workDescription: null,
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: 120,
    workMinutes: 420,
    manDays: null,
    isBillable: true,
    reflectToAttendance: true,
    reflectToSiteAttendance: true,
    dailyReport: { id: "r1", reportDate, projectId: "p1" },
  });
  db.tx.attendance.findUnique.mockResolvedValue(null);
  db.tx.attendance.create.mockResolvedValue({ id: "a1" });
  db.tx.siteAttendance.create.mockResolvedValue({ id: "s1" });
});

describe("作業員の追加", () => {
  it("通常は明細・勤怠・出面が1件ずつ作られ、操作ログは保存後に書かれる", async () => {
    db.tx.dailyReportWorker.findFirst.mockResolvedValueOnce(null); // 重複なし
    const { addDailyReportWorkerAction } = await import("@/app/(app)/daily-reports/actions");

    await addDailyReportWorkerAction(form());

    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.tx.dailyReportWorker.create).toHaveBeenCalledTimes(1);
    expect(db.tx.attendance.create).toHaveBeenCalledTimes(1);
    expect(db.tx.siteAttendance.create).toHaveBeenCalledTimes(1);
    expect(audit.logAction).toHaveBeenCalledTimes(3);
  });

  it("同じ人・同じ時間帯を2回送っても、2回目は何も作らない(出面が2件にならない)", async () => {
    db.tx.dailyReportWorker.findFirst.mockResolvedValueOnce({ id: "w1" }); // すでにある
    const { addDailyReportWorkerAction } = await import("@/app/(app)/daily-reports/actions");

    await addDailyReportWorkerAction(form());

    expect(db.tx.dailyReportWorker.create).not.toHaveBeenCalled();
    expect(db.tx.siteAttendance.create).not.toHaveBeenCalled();
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it("出面の作成で失敗したら、処理全体がエラーになり操作ログも書かれない(保存単位ごと取消し)", async () => {
    db.tx.dailyReportWorker.findFirst.mockResolvedValueOnce(null);
    db.tx.siteAttendance.create.mockRejectedValueOnce(new Error("DB接続切れ"));
    const { addDailyReportWorkerAction } = await import("@/app/(app)/daily-reports/actions");

    await expect(addDailyReportWorkerAction(form())).rejects.toThrow("DB接続切れ");
    // 明細・勤怠の作成は同じ$transactionの中で呼ばれている(=DB側で一緒に取り消される)
    expect(db.tx.dailyReportWorker.create).toHaveBeenCalledTimes(1);
    expect(db.tx.attendance.create).toHaveBeenCalledTimes(1);
    expect(audit.logAction).not.toHaveBeenCalled();
  });

  it("重複の確認は、自社従業員なら従業員ID・時間帯で行う", async () => {
    db.tx.dailyReportWorker.findFirst.mockResolvedValueOnce(null);
    const { addDailyReportWorkerAction } = await import("@/app/(app)/daily-reports/actions");

    await addDailyReportWorkerAction(form());

    expect(db.tx.dailyReportWorker.findFirst.mock.calls[0][0]).toEqual({
      where: { dailyReportId: "r1", employeeId: "emp1", startTime: "08:00", endTime: "17:00" },
    });
  });
});
