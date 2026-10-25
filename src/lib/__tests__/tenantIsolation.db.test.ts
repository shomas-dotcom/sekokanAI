import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// 「A社のユーザーがB社のデータを取得・更新・削除できないこと」を確認する結合テスト
// (RISK_REGISTER.md「会社間データ漏洩」対応)。
// 各Server Action(例: src/app/(app)/daily-reports/[id]/photos/actions.ts)は毎回
// `where: { id, companyId: user.companyId }` の形でクエリしており、本テストはその
// パターンが実際にB社のIDを弾くことを、業務データを持つ主要モデルすべてで検証する。
// Postgres移行後は開発用DB(.envのDATABASE_URL)に直接接続し、このテストが作った
// 会社だけを終了後に削除する(専用の使い捨てDBは用意しない)。
const TEST_COMPANY_PREFIX = "テナント分離テスト";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

async function setupTwoCompanies() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const companyA = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}A社-${suffix}` } });
  const companyB = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}B社-${suffix}` } });

  const customerB = await prisma.customer.create({ data: { companyId: companyB.id, name: "B社の顧客" } });
  const projectB = await prisma.project.create({
    data: { companyId: companyB.id, customerId: customerB.id, name: "B社の現場" },
  });
  const quoteB = await prisma.quote.create({
    data: { companyId: companyB.id, projectId: projectB.id, title: "B社の見積" },
  });
  const dailyReportB = await prisma.dailyReport.create({
    data: { companyId: companyB.id, projectId: projectB.id, reportDate: new Date() },
  });
  const invoiceB = await prisma.invoice.create({
    data: {
      companyId: companyB.id,
      projectId: projectB.id,
      invoiceNumber: `TEST-${Date.now()}-${suffix}`,
      issueDate: new Date(),
    },
  });

  return { companyA, companyB, projectB, quoteB, dailyReportB, invoiceB };
}

describe("テナント分離: A社からB社のデータへアクセスできない", () => {
  it("現場(Project)をB社のIDと自社のcompanyIdで検索すると見つからない", async () => {
    const { companyA, projectB } = await setupTwoCompanies();
    const result = await prisma.project.findFirst({
      where: { id: projectB.id, companyId: companyA.id },
    });
    expect(result).toBeNull();
  });

  it("見積(Quote)をB社のIDと自社のcompanyIdで検索すると見つからない", async () => {
    const { companyA, quoteB } = await setupTwoCompanies();
    const result = await prisma.quote.findFirst({
      where: { id: quoteB.id, companyId: companyA.id },
    });
    expect(result).toBeNull();
  });

  it("日報(DailyReport)をB社のIDと自社のcompanyIdで検索すると見つからない", async () => {
    const { companyA, dailyReportB } = await setupTwoCompanies();
    const result = await prisma.dailyReport.findFirst({
      where: { id: dailyReportB.id, companyId: companyA.id },
    });
    expect(result).toBeNull();
  });

  it("請求書(Invoice)をB社のIDと自社のcompanyIdで検索すると見つからない", async () => {
    const { companyA, invoiceB } = await setupTwoCompanies();
    const result = await prisma.invoice.findFirst({
      where: { id: invoiceB.id, companyId: companyA.id },
    });
    expect(result).toBeNull();
  });

  it("B社のIDをA社のcompanyId条件付きで更新しようとしても0件しか更新されない(updateMany)", async () => {
    const { companyA, dailyReportB } = await setupTwoCompanies();
    const result = await prisma.dailyReport.updateMany({
      where: { id: dailyReportB.id, companyId: companyA.id },
      data: { weather: "改ざん" },
    });
    expect(result.count).toBe(0);

    const untouched = await prisma.dailyReport.findUnique({ where: { id: dailyReportB.id } });
    expect(untouched?.weather).toBeNull();
  });

  it("B社のIDをA社のcompanyId条件付きで削除しようとしても0件しか削除されない(deleteMany)", async () => {
    const { companyA, dailyReportB } = await setupTwoCompanies();
    const result = await prisma.dailyReport.deleteMany({
      where: { id: dailyReportB.id, companyId: companyA.id },
    });
    expect(result.count).toBe(0);

    const stillExists = await prisma.dailyReport.findUnique({ where: { id: dailyReportB.id } });
    expect(stillExists).not.toBeNull();
  });

  it("正しいcompanyId(B社自身)であれば取得できる(検索条件自体が壊れていないことの確認)", async () => {
    const { companyB, projectB } = await setupTwoCompanies();
    const result = await prisma.project.findFirst({
      where: { id: projectB.id, companyId: companyB.id },
    });
    expect(result?.id).toBe(projectB.id);
  });
});

// 日報かんたん入力(2026-10追加)のマスタ類。機械の単価・労務単価は機微な情報のため、
// A社の操作でB社のものを読んだり変えたりできないことを、更新・削除の条件の形で確認する。
describe("テナント分離: 日報かんたん入力のマスタ", () => {
  async function setupMasters() {
    const suffix = Math.random().toString(36).slice(2, 8);
    const companyA = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}マスタA社-${suffix}` } });
    const companyB = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}マスタB社-${suffix}` } });
    const machineB = await prisma.machineMaster.create({
      data: { companyId: companyB.id, name: "B社のバックホー", unitPrice: 50000 },
    });
    const hazardB = await prisma.kyHazardMaster.create({ data: { companyId: companyB.id, label: "B社の危険" } });
    const employeeB = await prisma.employee.create({ data: { companyId: companyB.id, name: "B社の従業員" } });
    const employeeRateB = await prisma.employeeLaborRate.create({
      data: { companyId: companyB.id, employeeId: employeeB.id, dailyUnitPrice: 33000 },
    });
    const categoryRateB = await prisma.laborCategoryRate.create({
      data: { companyId: companyB.id, category: "OPERATOR", dailyUnitPrice: 36000 },
    });
    return { companyA, companyB, machineB, hazardB, employeeRateB, categoryRateB };
  }

  it("A社の条件では、B社の機械マスタ(単価)を取得・更新・削除できない", async () => {
    const { companyA, machineB } = await setupMasters();
    expect(await prisma.machineMaster.findFirst({ where: { id: machineB.id, companyId: companyA.id } })).toBeNull();
    const updated = await prisma.machineMaster.updateMany({
      where: { id: machineB.id, companyId: companyA.id },
      data: { unitPrice: 1 },
    });
    expect(updated.count).toBe(0);
    const deleted = await prisma.machineMaster.deleteMany({ where: { id: machineB.id, companyId: companyA.id } });
    expect(deleted.count).toBe(0);
    expect((await prisma.machineMaster.findUniqueOrThrow({ where: { id: machineB.id } })).unitPrice).toBe(50000);
  });

  it("A社の条件では、B社のKYマスタを更新できない", async () => {
    const { companyA, hazardB } = await setupMasters();
    const updated = await prisma.kyHazardMaster.updateMany({
      where: { id: hazardB.id, companyId: companyA.id },
      data: { label: "改ざん" },
    });
    expect(updated.count).toBe(0);
    expect((await prisma.kyHazardMaster.findUniqueOrThrow({ where: { id: hazardB.id } })).label).toBe("B社の危険");
  });

  it("A社の条件では、B社の労務単価(従業員別・区分別)を取得・削除できない", async () => {
    const { companyA, employeeRateB, categoryRateB } = await setupMasters();
    expect(await prisma.employeeLaborRate.findMany({ where: { companyId: companyA.id } })).toHaveLength(0);
    expect(await prisma.laborCategoryRate.findMany({ where: { companyId: companyA.id } })).toHaveLength(0);
    expect((await prisma.employeeLaborRate.deleteMany({ where: { id: employeeRateB.id, companyId: companyA.id } })).count).toBe(0);
    expect((await prisma.laborCategoryRate.deleteMany({ where: { id: categoryRateB.id, companyId: companyA.id } })).count).toBe(0);
  });

  it("会社を削除すると、その会社のマスタ・単価も一緒に消える(他社のものは残る)", async () => {
    const { companyA, companyB, machineB } = await setupMasters();
    await prisma.machineMaster.create({ data: { companyId: companyA.id, name: "A社の機械" } });
    await prisma.company.delete({ where: { id: companyA.id } });
    expect(await prisma.machineMaster.count({ where: { companyId: companyA.id } })).toBe(0);
    expect(await prisma.machineMaster.findUnique({ where: { id: machineB.id } })).not.toBeNull();
    expect(companyB.id).toBeTruthy();
  });
});
