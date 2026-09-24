import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// 原価集計表(日当・単価を含む)を一般社員・現場責任者が閲覧・変更・出力できないことを確認する。
// DB・セッションは置き換えた模擬試験であり、実DBでの試験の代わりにはならない。

const session = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));
const db = vi.hoisted(() => ({
  dailyReport: { findFirst: vi.fn() },
  dailyReportLaborEntry: { count: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), delete: vi.fn(), aggregate: vi.fn() },
  dailyReportOwnItem: { aggregate: vi.fn() },
  dailyReportPartnerItem: { aggregate: vi.fn() },
  company: { update: vi.fn() },
}));

vi.mock("@/lib/session", () => ({
  getSessionUser: async () => session.user,
  destroySession: async () => {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/ai", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function makeUser(role: string) {
  return {
    id: "u1",
    companyId: "c1",
    role,
    name: "テスト",
    deletedAt: null,
    company: { id: "c1", isSuspended: false, subscriptionStatus: "active", plan: "PREMIUM", trialEndsAt: null },
  };
}

function laborForm() {
  const fd = new FormData();
  fd.set("dailyReportId", "r1");
  fd.set("workerName", "田中");
  fd.set("unitPrice", "30000");
  return fd;
}

// 初回の読込み(Next.js・ExcelJS)が遅いため、個々の試験の時間制限に含めない。
beforeAll(async () => {
  await import("@/app/(app)/daily-reports/[id]/cost-ledger/actions");
  await import("@/app/(app)/daily-reports/[id]/cost-ledger-xlsx/route");
}, 120_000);

beforeEach(() => {
  vi.clearAllMocks();
  db.dailyReport.findFirst.mockResolvedValue({ id: "r1", companyId: "c1", projectId: "p1" });
  db.dailyReportLaborEntry.count.mockResolvedValue(0);
  db.dailyReportLaborEntry.create.mockResolvedValue({ id: "e1" });
});

describe("原価集計表の保存処理", () => {
  it.each(["MEMBER", "SITE_MANAGER"])("%s は日当を追加できない", async (role) => {
    session.user = makeUser(role);
    const { addLaborEntryAction } = await import("@/app/(app)/daily-reports/[id]/cost-ledger/actions");

    await expect(addLaborEntryAction(laborForm())).rejects.toThrow();
    expect(db.dailyReportLaborEntry.create).not.toHaveBeenCalled();
  });

  it("管理者は日当を追加できる", async () => {
    session.user = makeUser("ADMIN");
    const { addLaborEntryAction } = await import("@/app/(app)/daily-reports/[id]/cost-ledger/actions");

    await addLaborEntryAction(laborForm());
    expect(db.dailyReportLaborEntry.create).toHaveBeenCalledTimes(1);
  });

  it("一般社員は日当の行を削除できない", async () => {
    session.user = makeUser("MEMBER");
    const { deleteLaborEntryAction } = await import("@/app/(app)/daily-reports/[id]/cost-ledger/actions");
    const fd = new FormData();
    fd.set("id", "e1");
    fd.set("dailyReportId", "r1");

    await expect(deleteLaborEntryAction(fd)).rejects.toThrow();
    expect(db.dailyReportLaborEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("管理者の削除は、その日報の行に限定される(他社の行IDでは消えない)", async () => {
    session.user = makeUser("ADMIN");
    const { deleteLaborEntryAction } = await import("@/app/(app)/daily-reports/[id]/cost-ledger/actions");
    const fd = new FormData();
    fd.set("id", "other-company-row");
    fd.set("dailyReportId", "r1");

    await deleteLaborEntryAction(fd);
    expect(db.dailyReportLaborEntry.delete).not.toHaveBeenCalled();
    expect(db.dailyReportLaborEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: "other-company-row", dailyReportId: "r1" },
    });
  });
});

describe("原価集計表のExcel出力", () => {
  it.each(["MEMBER", "SITE_MANAGER"])("%s は出力できず403になる", async (role) => {
    session.user = makeUser(role);
    const { GET } = await import("@/app/(app)/daily-reports/[id]/cost-ledger-xlsx/route");

    const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(403);
    expect(db.dailyReport.findFirst).not.toHaveBeenCalled();
  });
});
