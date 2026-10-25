import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { ensureDailyReportMasters, loadQuickMasters } from "@/lib/dailyReport/masters";
import { QuickSaveError, saveQuickReport, type QuickSaveInput } from "@/lib/dailyReport/saveQuick";
import type { QuickKy, QuickLabor, QuickMachine, QuickState, QuickWork } from "@/lib/dailyReport/quickInput";

// かんたん入力(4タブ)の保存・修正・原価への反映・会社ごとの分離を確かめる結合テスト。
// このテストが作った会社(名前が「かんたん入力テスト」で始まるもの)だけを終了後に削除する。
const TEST_COMPANY_PREFIX = "かんたん入力テスト株式会社";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

const DATE1 = new Date("2026-10-01");
const DATE2 = new Date("2026-10-06");

let seq = 0;
const key = () => `t${++seq}`;

async function setup() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-${suffix}` } });
  const admin = await prisma.user.create({
    data: { companyId: company.id, email: `qs-admin-${suffix}@example.invalid`, name: "管理者", role: "ADMIN" },
  });
  const member = await prisma.user.create({
    data: { companyId: company.id, email: `qs-member-${suffix}@example.invalid`, name: "一般", role: "MEMBER" },
  });
  const employee = await prisma.employee.create({ data: { companyId: company.id, name: "テスト太郎" } });
  const employee2 = await prisma.employee.create({ data: { companyId: company.id, name: "テスト次郎" } });
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: "テスト顧客" } });
  const project = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "テスト現場" },
  });
  await ensureDailyReportMasters(company.id);
  return { company, admin, member, employee, employee2, project };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const emptyState: QuickState = { works: [], machines: [], labor: [], ky: [] };

const work = (label: string, extra: Partial<QuickWork> = {}): QuickWork => ({
  key: key(),
  workItemId: null,
  label,
  quantity: null,
  unit: null,
  workMinutes: null,
  remarks: null,
  ...extra,
});
const machine = (name: string, extra: Partial<QuickMachine> = {}): QuickMachine => ({
  key: key(),
  id: null,
  machineId: null,
  name,
  ownership: "OWN",
  quantity: 1,
  usageValue: 1,
  ...extra,
});
const labor = (extra: Partial<QuickLabor> = {}): QuickLabor => ({
  key: key(),
  id: null,
  category: "SUBCONTRACT_WORKER",
  employeeId: null,
  workerName: "",
  affiliation: null,
  headcount: 1,
  manDays: 1,
  workMinutes: null,
  ...extra,
});
const ky = (label: string, extra: Partial<QuickKy> = {}): QuickKy => ({
  key: key(),
  hazardId: null,
  label,
  measures: [],
  ...extra,
});

async function save(ctx: Ctx, overrides: Partial<QuickSaveInput> & { state: QuickState }, role: "ADMIN" | "MEMBER" = "ADMIN") {
  const settings = await getOrCreateWorkSettings(ctx.company.id);
  const actorUser = role === "ADMIN" ? ctx.admin : ctx.member;
  return prisma.$transaction(
    (tx) =>
      saveQuickReport(tx, {
        actor: { id: actorUser.id, companyId: ctx.company.id, role },
        settings,
        reportId: null,
        projectId: ctx.project.id,
        reportDate: DATE1,
        weather: null,
        gps: null,
        memo: "",
        nextDayPlan: null,
        ...overrides,
      }),
    { timeout: 30_000 }
  );
}

describe("標準項目の自動投入", () => {
  it("作業内容24・機械17・危険16が入り、2回呼んでも増えない。機械の単価は入れない", async () => {
    const ctx = await setup();
    await ensureDailyReportMasters(ctx.company.id);
    await ensureDailyReportMasters(ctx.company.id);
    expect(await prisma.workItemMaster.count({ where: { companyId: ctx.company.id } })).toBe(24);
    expect(await prisma.machineMaster.count({ where: { companyId: ctx.company.id } })).toBe(17);
    expect(await prisma.kyHazardMaster.count({ where: { companyId: ctx.company.id } })).toBe(16);
    expect(await prisma.machineMaster.count({ where: { companyId: ctx.company.id, unitPrice: { not: null } } })).toBe(0);
    const hazard = await prisma.kyHazardMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, label: "掘削箇所の崩壊" } });
    expect(JSON.parse(hazard.measuresJson)).toEqual(["地山点検", "土留め確認", "立入範囲の管理"]);
  });

  it("会社がすでに登録していた作業内容は消えず、同じ名前の標準項目は重ならない", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-existing-${suffix}` } });
    await prisma.workItemMaster.createMany({
      data: [
        { companyId: company.id, label: "独自の作業", sortOrder: 0 },
        { companyId: company.id, label: "掘削工", sortOrder: 1 },
      ],
    });
    await ensureDailyReportMasters(company.id);
    const labels = (await prisma.workItemMaster.findMany({ where: { companyId: company.id } })).map((w) => w.label);
    expect(labels).toContain("独自の作業");
    expect(labels.filter((l) => l === "掘削工")).toHaveLength(1);
    expect(labels).toHaveLength(25); // 独自1 + 標準24(掘削工は重ならない)
  });

  it("会社が消した標準項目は、あとで復活しない", async () => {
    const ctx = await setup();
    await prisma.workItemMaster.deleteMany({ where: { companyId: ctx.company.id, label: "清掃" } });
    await ensureDailyReportMasters(ctx.company.id);
    expect(await prisma.workItemMaster.count({ where: { companyId: ctx.company.id, label: "清掃" } })).toBe(0);
  });

  it("一般の利用者には単価・労務単価を渡さず、管理者には渡す", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { unitPrice: 45000 } });
    await prisma.laborCategoryRate.create({ data: { companyId: ctx.company.id, category: "OPERATOR", dailyUnitPrice: 33000 } });

    const asMember = await loadQuickMasters({ companyId: ctx.company.id, role: "MEMBER" });
    expect(asMember.canSeeCosts).toBe(false);
    expect(asMember.machines.every((m) => m.unitPrice === null)).toBe(true);
    expect(asMember.laborRates).toBeNull();

    const asAdmin = await loadQuickMasters({ companyId: ctx.company.id, role: "ADMIN" });
    expect(asAdmin.machines.find((m) => m.name === "バックホー0.25㎥")?.unitPrice).toBe(45000);
    expect(asAdmin.laborRates?.byCategory.OPERATOR).toBe(33000);
  });

  it("無効にした項目は入力画面に出ない", async () => {
    const ctx = await setup();
    await prisma.machineMaster.updateMany({ where: { companyId: ctx.company.id, name: "ランマー" }, data: { isActive: false } });
    const masters = await loadQuickMasters({ companyId: ctx.company.id, role: "MEMBER" });
    expect(masters.machines.map((m) => m.name)).not.toContain("ランマー");
    expect(masters.machines).toHaveLength(16);
  });
});

describe("かんたん入力の保存", () => {
  it("作業内容・機械・労務・KYを保存し、既存の文章欄・作業員数・出面にも反映する", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    const dump = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "4tダンプ" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { unitPrice: 45000 } });
    await prisma.laborCategoryRate.create({ data: { companyId: ctx.company.id, category: "SUBCONTRACT_WORKER", dailyUnitPrice: 24000 } });
    await prisma.employeeLaborRate.create({ data: { companyId: ctx.company.id, employeeId: ctx.employee.id, dailyUnitPrice: 30000 } });
    const sewer = await prisma.workItemMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, label: "汚水管布設" } });
    const hazard = await prisma.kyHazardMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, label: "重機との接触" } });

    const result = await save(ctx, {
      weather: "晴れ",
      nextDayPlan: "桝設置",
      memo: "今日は汚水管を20m布設",
      state: {
        works: [work("汚水管布設", { workItemId: sewer.id, quantity: 20, unit: "m", workMinutes: 240 })],
        machines: [
          machine("バックホー0.25㎥", { machineId: bh.id, quantity: 2, usageValue: 1.5 }),
          machine("4tダンプ", { machineId: dump.id, ownership: "RENTAL" }),
        ],
        labor: [
          labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, manDays: 1 }),
          labor({ category: "SUBCONTRACT_WORKER", affiliation: "山田組", headcount: 3, manDays: 0.5 }),
        ],
        ky: [ky("重機との接触", { hazardId: hazard.id, measures: ["合図者配置", "周囲確認"] })],
      },
    });
    expect(result.created).toBe(true);

    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: result.reportId } });
    expect(report.weather).toBe("晴れ");
    expect(report.nextDayPlan).toBe("桝設置");
    expect(report.workContent).toBe("汚水管布設 20m(4時間)");
    expect(report.quantityWorked).toBe("汚水管布設 20m");
    expect(report.machinery).toBe("バックホー0.25㎥ 2台");
    expect(report.vehicles).toBe("4tダンプ 1台(レンタル)");
    expect(report.dangerPrediction).toBe("重機との接触(対策: 合図者配置、周囲確認)");
    expect(report.workerCount).toBe(4); // 1名 + 3名
    expect(report.rawVoiceInput).toBe("今日は汚水管を20m布設");

    // 機械: 2台 × 1.5日 × 45,000円 = 135,000円。単価が未登録のダンプは金額を出さない(0円にしない)。
    const usages = await prisma.dailyReportMachineUsage.findMany({ where: { dailyReportId: report.id }, orderBy: { sortOrder: "asc" } });
    expect(usages.map((u) => u.amount)).toEqual([135000, null]);
    const expenses = await prisma.siteExpenseEntry.findMany({ where: { sourceDailyReportId: report.id }, orderBy: { createdAt: "asc" } });
    expect(expenses).toHaveLength(2);
    expect(expenses[0]).toMatchObject({ category: "MACHINERY", amount: 135000, isBillable: false, isCostTarget: true, projectId: ctx.project.id });
    expect(expenses[1].amount).toBeNull();

    // 労務: 従業員は本人の単価(30,000円×1人工)、外注は区分の単価(24,000円×3名×0.5人工=36,000円)
    const sites = await prisma.siteAttendance.findMany({ where: { sourceDailyReportId: report.id }, orderBy: { createdAt: "asc" } });
    expect(sites).toHaveLength(2);
    const own = sites.find((s) => s.employeeId === ctx.employee.id)!;
    expect(own).toMatchObject({ manDays: 1, laborCostUnitPrice: 30000, laborCostAmount: 30000, status: "SUBMITTED" });
    const sub = sites.find((s) => s.employeeId === null)!;
    expect(sub).toMatchObject({ manDays: 1.5, laborCostUnitPrice: 24000, laborCostAmount: 36000, workerName: "山田組 外注作業員(3名)" });
    // 自社従業員は勤怠も作られる(1人工=8時間として480分)。外注は勤怠なし。
    const attendance = await prisma.attendance.findMany({ where: { companyId: ctx.company.id } });
    expect(attendance).toHaveLength(1);
    expect(attendance[0]).toMatchObject({ employeeId: ctx.employee.id, actualWorkMinutes: 480 });

    // 作業内容・KYの明細
    const works = await prisma.dailyReportWorkEntry.findMany({ where: { dailyReportId: report.id } });
    expect(works).toMatchObject([{ label: "汚水管布設", quantity: 20, unit: "m", workMinutes: 240, workItemId: sewer.id }]);
    const kyEntries = await prisma.dailyReportKyEntry.findMany({ where: { dailyReportId: report.id } });
    expect(JSON.parse(kyEntries[0].measuresJson)).toEqual(["合図者配置", "周囲確認"]);
  });

  it("新規作成では、話した内容から読み取った開始/終了時間・安全確認・職長を補う。入力した天候が優先される。修正では使わない", async () => {
    const ctx = await setup();
    const voiceDraft = { weather: "曇り", startTime: "08:00", endTime: "17:00", safetyNotes: "特に異常なし", foremanName: "田中" };
    const created = await save(ctx, { weather: "晴れ", voiceDraft, state: emptyState });
    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: created.reportId } });
    expect(report).toMatchObject({ weather: "晴れ", startTime: "08:00", endTime: "17:00", safetyNotes: "特に異常なし", foremanName: "田中" });

    const noWeather = await save(ctx, { weather: null, voiceDraft, state: emptyState });
    expect((await prisma.dailyReport.findUniqueOrThrow({ where: { id: noWeather.reportId } })).weather).toBe("曇り");

    // 修正のときは、読み取りの結果を使わない(人が直した値を上書きしない)
    await save(ctx, {
      reportId: created.reportId,
      weather: "雨",
      voiceDraft: { ...voiceDraft, startTime: "06:00" },
      state: emptyState,
    });
    const edited = await prisma.dailyReport.findUniqueOrThrow({ where: { id: created.reportId } });
    expect(edited).toMatchObject({ weather: "雨", startTime: "08:00" });
  });

  it("単価が未登録の労務は、原価を0円にせず未入力のまま残す(従来の動きのまま)", async () => {
    const ctx = await setup();
    const result = await save(ctx, { state: { ...emptyState, labor: [labor({ category: "OTHER", headcount: 2, manDays: 1 })] } });
    const site = await prisma.siteAttendance.findFirstOrThrow({ where: { sourceDailyReportId: result.reportId } });
    expect(site).toMatchObject({ manDays: 2, laborCostUnitPrice: null, laborCostAmount: null });
    expect(result.warnings.join()).toContain("労務単価が未登録");
  });

  it("一般の利用者の保存でも、金額はサーバーでマスタの単価から計算される(単価未登録の注意は管理者だけ)", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { unitPrice: 40000 } });
    const result = await save(ctx, { state: { ...emptyState, machines: [machine("バックホー0.25㎥", { machineId: bh.id })] } }, "MEMBER");
    const usage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: result.reportId } });
    expect(usage.amount).toBe(40000);
    expect(result.warnings.join()).not.toContain("単価が未登録");
  });

  it("運転手込みの機械に重機オペレーターの人工も入れると、二重計上の注意が出る", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { includesOperator: true, unitPrice: 60000 } });
    const result = await save(ctx, {
      state: { ...emptyState, machines: [machine("バックホー0.25㎥", { machineId: bh.id })], labor: [labor({ category: "OPERATOR" })] },
    });
    expect(result.warnings.join()).toContain("二重に数えていない");
  });

  it("同じ日の別の日報と合わせて1人工を超えると注意が出る(現場を移動したとき)", async () => {
    const ctx = await setup();
    const project2 = await prisma.project.create({
      data: { companyId: ctx.company.id, customerId: (await prisma.customer.findFirstOrThrow({ where: { companyId: ctx.company.id } })).id, name: "別の現場" },
    });
    await save(ctx, { state: { ...emptyState, labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, manDays: 0.5 })] } });
    const second = await save(ctx, {
      projectId: project2.id,
      state: { ...emptyState, labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, manDays: 0.5 })] },
    });
    expect(second.warnings.join()).not.toContain("超えています");
    const third = await save(ctx, {
      projectId: project2.id,
      state: { ...emptyState, labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, manDays: 0.5 })] },
    });
    expect(third.warnings.join()).toContain("1人工を超えています");
  });
});

describe("前回の日報の修正", () => {
  it("同じ内容で保存し直しても、明細・出面・経費は増えない(二重に登録されない)", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { unitPrice: 45000 } });
    const first = await save(ctx, {
      state: {
        ...emptyState,
        works: [work("掘削工")],
        machines: [machine("バックホー0.25㎥", { machineId: bh.id })],
        labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id })],
      },
    });

    const usage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    const worker = await prisma.dailyReportWorker.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    const second = await save(ctx, {
      reportId: first.reportId,
      state: {
        ...emptyState,
        works: [work("掘削工")],
        machines: [machine("バックホー0.25㎥", { machineId: bh.id, id: usage.id })],
        labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, id: worker.id })],
      },
    });
    expect(second.created).toBe(false);
    expect(await prisma.dailyReportMachineUsage.count({ where: { dailyReportId: first.reportId } })).toBe(1);
    expect(await prisma.siteExpenseEntry.count({ where: { sourceDailyReportId: first.reportId } })).toBe(1);
    expect(await prisma.dailyReportWorker.count({ where: { dailyReportId: first.reportId } })).toBe(1);
    expect(await prisma.siteAttendance.count({ where: { sourceDailyReportId: first.reportId } })).toBe(1);
    expect(await prisma.attendance.count({ where: { companyId: ctx.company.id } })).toBe(1);
    expect(await prisma.dailyReportWorkEntry.count({ where: { dailyReportId: first.reportId } })).toBe(1);
  });

  it("人工数・台数を直すと、出面と経費の金額も直る。機械を消すと経費も消え、労務を消すと出面・勤怠も消える", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: bh.id }, data: { unitPrice: 45000 } });
    await prisma.employeeLaborRate.create({ data: { companyId: ctx.company.id, employeeId: ctx.employee.id, dailyUnitPrice: 30000 } });
    const first = await save(ctx, {
      state: {
        ...emptyState,
        machines: [machine("バックホー0.25㎥", { machineId: bh.id })],
        labor: [
          labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, manDays: 1 }),
          labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee2.id, manDays: 1 }),
        ],
      },
    });
    const usage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    const workers = await prisma.dailyReportWorker.findMany({ where: { dailyReportId: first.reportId } });
    const w1 = workers.find((w) => w.employeeId === ctx.employee.id)!;

    // 台数1→2、人工1→0.5、次郎さんの行は消す
    await save(ctx, {
      reportId: first.reportId,
      state: {
        ...emptyState,
        machines: [machine("バックホー0.25㎥", { machineId: bh.id, id: usage.id, quantity: 2 })],
        labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, id: w1.id, manDays: 0.5 })],
      },
    });
    const expense = await prisma.siteExpenseEntry.findFirstOrThrow({ where: { sourceDailyReportId: first.reportId } });
    expect(expense.amount).toBe(90000);
    const sites = await prisma.siteAttendance.findMany({ where: { sourceDailyReportId: first.reportId } });
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ manDays: 0.5, laborCostAmount: 15000 });
    const attendance = await prisma.attendance.findMany({ where: { companyId: ctx.company.id } });
    expect(attendance.map((a) => a.employeeId)).toEqual([ctx.employee.id]);
    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } });
    expect(report.workerCount).toBe(1);

    // 機械も労務も全部消す
    await save(ctx, { reportId: first.reportId, state: emptyState });
    expect(await prisma.siteExpenseEntry.count({ where: { sourceDailyReportId: first.reportId } })).toBe(0);
    expect(await prisma.siteAttendance.count({ where: { sourceDailyReportId: first.reportId } })).toBe(0);
    expect(await prisma.attendance.count({ where: { companyId: ctx.company.id } })).toBe(0);
    const cleared = await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } });
    expect(cleared.workerCount).toBeNull();
    expect(cleared.machinery).toBeNull();
  });

  it("労務の「担当した作業」は出面の作業内容に入り、未指定なら残り、空欄にすると消える", async () => {
    const ctx = await setup();
    const first = await save(ctx, { state: { ...emptyState, labor: [labor({ workDescription: "掘削・配管" })] } });
    const worker = await prisma.dailyReportWorker.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    const site = () => prisma.siteAttendance.findFirstOrThrow({ where: { sourceDailyReportId: first.reportId } });
    expect(worker.workDescription).toBe("掘削・配管");
    expect((await site()).workContent).toBe("掘削・配管");

    // 項目を送らない(古い入力途中の内容など)ときは、保存してある内容を変えない
    await save(ctx, { reportId: first.reportId, state: { ...emptyState, labor: [labor({ id: worker.id })] } });
    expect((await site()).workContent).toBe("掘削・配管");

    // 空欄にしたときだけ消える
    await save(ctx, { reportId: first.reportId, state: { ...emptyState, labor: [labor({ id: worker.id, workDescription: null })] } });
    expect((await site()).workContent).toBeNull();
  });

  it("出面が承認済みの行は、日報を直しても変わらず、理由が伝えられる", async () => {
    const ctx = await setup();
    const first = await save(ctx, { state: { ...emptyState, labor: [labor({ category: "SUBCONTRACT_WORKER", headcount: 2, manDays: 1 })] } });
    const worker = await prisma.dailyReportWorker.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    await prisma.siteAttendance.updateMany({ where: { sourceDailyReportId: first.reportId }, data: { status: "APPROVED" } });

    const second = await save(ctx, {
      reportId: first.reportId,
      state: { ...emptyState, labor: [labor({ category: "SUBCONTRACT_WORKER", headcount: 5, manDays: 1, id: worker.id })] },
    });
    const site = await prisma.siteAttendance.findFirstOrThrow({ where: { sourceDailyReportId: first.reportId } });
    expect(site.manDays).toBe(2); // 承認済みなので5人には変わらない
    // 変更を反映しなかったことは画面の出面状態で分かる(承認済みの表示)。単価未登録の案内以外の注意は出ない
    expect(second.warnings.filter((w) => !w.includes("未登録"))).toEqual([]);

    // 行を消しても、承認済みの出面は残り、理由が伝えられる
    const third = await save(ctx, { reportId: first.reportId, state: emptyState });
    expect(await prisma.siteAttendance.count({ where: { sourceDailyReportId: first.reportId } })).toBe(1);
    expect(third.warnings.join()).toContain("承認済み");
  });

  it("日付を変えて保存すると、日報・出面・勤怠・機械の経費がそろって新しい日に動く", async () => {
    const ctx = await setup();
    const bh = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: ctx.company.id, name: "バックホー0.25㎥" } });
    const first = await save(ctx, {
      state: {
        ...emptyState,
        machines: [machine("バックホー0.25㎥", { machineId: bh.id })],
        labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id })],
      },
    });
    const usage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    const worker = await prisma.dailyReportWorker.findFirstOrThrow({ where: { dailyReportId: first.reportId } });

    const second = await save(ctx, {
      reportId: first.reportId,
      reportDate: DATE2,
      state: {
        ...emptyState,
        machines: [machine("バックホー0.25㎥", { machineId: bh.id, id: usage.id })],
        labor: [labor({ category: "OWN_EMPLOYEE", employeeId: ctx.employee.id, id: worker.id })],
      },
    });
    expect(second.warnings.filter((w) => !w.includes("未登録"))).toEqual([]);
    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } });
    expect(report.reportDate.getTime()).toBe(DATE2.getTime());
    expect((await prisma.siteAttendance.findFirstOrThrow({ where: { sourceDailyReportId: first.reportId } })).targetDate.getTime()).toBe(DATE2.getTime());
    expect((await prisma.attendance.findFirstOrThrow({ where: { companyId: ctx.company.id } })).targetDate.getTime()).toBe(DATE2.getTime());
    expect((await prisma.siteExpenseEntry.findFirstOrThrow({ where: { sourceDailyReportId: first.reportId } })).targetDate.getTime()).toBe(DATE2.getTime());
    expect(await prisma.siteAttendance.count({ where: { sourceDailyReportId: first.reportId } })).toBe(1);
  });

  it("日付が変えられないとき(承認済み)でも、他の内容は保存され、理由が伝えられる", async () => {
    const ctx = await setup();
    const first = await save(ctx, { state: { ...emptyState, labor: [labor()] } });
    const worker = await prisma.dailyReportWorker.findFirstOrThrow({ where: { dailyReportId: first.reportId } });
    await prisma.siteAttendance.updateMany({ where: { sourceDailyReportId: first.reportId }, data: { status: "APPROVED" } });

    const second = await save(ctx, {
      reportId: first.reportId,
      reportDate: DATE2,
      nextDayPlan: "翌日は型枠",
      state: { ...emptyState, works: [work("清掃")], labor: [labor({ id: worker.id })] },
    });
    expect(second.warnings.join()).toContain("日付は変更できませんでした");
    const report = await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } });
    expect(report.reportDate.getTime()).toBe(DATE1.getTime());
    expect(report.nextDayPlan).toBe("翌日は型枠");
    expect(report.workContent).toBe("清掃");
  });

  it("かんたん入力を使っていない古い日報は、何も選ばずに保存しても文章が消えない", async () => {
    const ctx = await setup();
    const legacy = await prisma.dailyReport.create({
      data: {
        companyId: ctx.company.id,
        projectId: ctx.project.id,
        reportDate: DATE1,
        workContent: "L型側溝据付20m",
        machinery: "0.25BH",
        vehicles: "4tダンプ",
        dangerPrediction: "重機接触",
        quantityWorked: "20m",
        workerCount: 4,
      },
    });
    await save(ctx, { reportId: legacy.id, memo: "L型側溝据付20m", state: emptyState });
    const after = await prisma.dailyReport.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(after).toMatchObject({
      workContent: "L型側溝据付20m",
      machinery: "0.25BH",
      vehicles: "4tダンプ",
      dangerPrediction: "重機接触",
      quantityWorked: "20m",
      workerCount: 4,
    });
  });

  it("かんたん入力で作業内容を全部外すと、メモの文章に戻る", async () => {
    const ctx = await setup();
    const first = await save(ctx, { memo: "メモ", state: { ...emptyState, works: [work("掘削工", { quantity: 3, unit: "㎥" })] } });
    expect((await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } })).workContent).toBe("掘削工 3㎥");
    await save(ctx, { reportId: first.reportId, memo: "メモ", state: emptyState });
    const after = await prisma.dailyReport.findUniqueOrThrow({ where: { id: first.reportId } });
    expect(after.workContent).toBe("メモ");
    expect(after.quantityWorked).toBeNull();
  });
});

describe("会社ごとのデータの分離", () => {
  it("他社の機械・作業内容・危険のIDを渡しても、他社のマスタの単価は使われない", async () => {
    const mine = await setup();
    const other = await setup();
    const foreignMachine = await prisma.machineMaster.findFirstOrThrow({ where: { companyId: other.company.id, name: "バックホー0.25㎥" } });
    await prisma.machineMaster.update({ where: { id: foreignMachine.id }, data: { unitPrice: 99999 } });
    const foreignWork = await prisma.workItemMaster.findFirstOrThrow({ where: { companyId: other.company.id } });
    const foreignHazard = await prisma.kyHazardMaster.findFirstOrThrow({ where: { companyId: other.company.id } });

    const result = await save(mine, {
      state: {
        ...emptyState,
        works: [work("掘削工", { workItemId: foreignWork.id })],
        machines: [machine("バックホー0.25㎥", { machineId: foreignMachine.id })],
        ky: [ky("重機との接触", { hazardId: foreignHazard.id })],
      },
    });
    const usage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: result.reportId } });
    expect(usage).toMatchObject({ machineId: null, unitPrice: null, amount: null });
    expect((await prisma.dailyReportWorkEntry.findFirstOrThrow({ where: { dailyReportId: result.reportId } })).workItemId).toBeNull();
    expect((await prisma.dailyReportKyEntry.findFirstOrThrow({ where: { dailyReportId: result.reportId } })).hazardId).toBeNull();
  });

  it("他社の従業員は選べない", async () => {
    const mine = await setup();
    const other = await setup();
    await expect(
      save(mine, { state: { ...emptyState, labor: [labor({ category: "OWN_EMPLOYEE", employeeId: other.employee.id })] } })
    ).rejects.toThrow(QuickSaveError);
  });

  it("他社の日報は修正できない・他社の案件では作成できない", async () => {
    const mine = await setup();
    const other = await setup();
    const otherReport = await save(other, { state: emptyState });
    await expect(save(mine, { reportId: otherReport.reportId, state: emptyState })).rejects.toThrow("日報が見つかりません");
    await expect(save(mine, { projectId: other.project.id, state: emptyState })).rejects.toThrow("案件が見つかりません");
    expect((await prisma.dailyReport.findUniqueOrThrow({ where: { id: otherReport.reportId } })).companyId).toBe(other.company.id);
  });

  it("他社の機械明細IDを指定しても、他社の明細は書き換わらない", async () => {
    const mine = await setup();
    const other = await setup();
    const otherResult = await save(other, { state: { ...emptyState, machines: [machine("ランマー")] } });
    const otherUsage = await prisma.dailyReportMachineUsage.findFirstOrThrow({ where: { dailyReportId: otherResult.reportId } });
    await save(mine, { state: { ...emptyState, machines: [machine("プレート", { id: otherUsage.id, quantity: 9 })] } });
    const after = await prisma.dailyReportMachineUsage.findUniqueOrThrow({ where: { id: otherUsage.id } });
    expect(after).toMatchObject({ name: "ランマー", quantity: 1 });
  });
});
