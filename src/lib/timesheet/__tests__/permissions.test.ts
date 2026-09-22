import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { canManageProjectTimesheet, getSupervisedProjectIds } from "@/lib/timesheet/permissions";

const TEST_COMPANY_PREFIX = "権限テスト";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

let ctx: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-${suffix}` } });
  const customer = await prisma.customer.create({ data: { companyId: company.id, name: "顧客" } });
  const projectA = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "現場A" },
  });
  const projectB = await prisma.project.create({
    data: { companyId: company.id, customerId: customer.id, name: "現場B" },
  });
  const admin = await prisma.user.create({
    data: { companyId: company.id, email: `admin-${suffix}@example.com`, name: "管理者", role: "ADMIN" },
  });
  const siteManager = await prisma.user.create({
    data: { companyId: company.id, email: `sm-${suffix}@example.com`, name: "現場責任者", role: "SITE_MANAGER" },
  });
  const member = await prisma.user.create({
    data: { companyId: company.id, email: `member-${suffix}@example.com`, name: "一般社員", role: "MEMBER" },
  });
  await prisma.projectSupervisor.create({ data: { projectId: projectA.id, userId: siteManager.id } });

  return { company, projectA, projectB, admin, siteManager, member };
}

beforeAll(async () => {
  ctx = await setup();
}, 30000);

describe("canManageProjectTimesheet", () => {
  it("管理者はどの現場でも管理できる", async () => {
    expect(await canManageProjectTimesheet(ctx.admin, ctx.projectA.id)).toBe(true);
    expect(await canManageProjectTimesheet(ctx.admin, ctx.projectB.id)).toBe(true);
  });

  it("現場責任者は担当している現場だけ管理できる", async () => {
    expect(await canManageProjectTimesheet(ctx.siteManager, ctx.projectA.id)).toBe(true);
    expect(await canManageProjectTimesheet(ctx.siteManager, ctx.projectB.id)).toBe(false);
  });

  it("一般社員はどの現場も管理できない", async () => {
    expect(await canManageProjectTimesheet(ctx.member, ctx.projectA.id)).toBe(false);
  });
});

describe("getSupervisedProjectIds", () => {
  it("担当している現場IDだけを返す", async () => {
    const ids = await getSupervisedProjectIds(ctx.siteManager.id);
    expect(ids).toContain(ctx.projectA.id);
    expect(ids).not.toContain(ctx.projectB.id);
  });

  it("担当現場がなければ空配列を返す", async () => {
    const ids = await getSupervisedProjectIds(ctx.member.id);
    expect(ids).toEqual([]);
  });
});
