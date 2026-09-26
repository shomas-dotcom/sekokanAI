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
