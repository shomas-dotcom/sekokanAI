import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { ensureDailyReportMasters } from "@/lib/dailyReport/masters";

// 標準項目の自動投入を、同時に何回呼んでも二重に入らないことの確認(同時実行の試験)。
// 試験用DB(PGlite)は同時の接続に弱く、同時実行の試験が失敗すると試験用DBが止まり、
// 同じ実行の後ろの試験まで巻き込んで失敗してしまう(numbering.db.test.ts と同じ事情)。
// そのため、全体の実行からは外し、このファイルだけを単独で動かす:
//   node tools/test-db/test.mjs src/lib/dailyReport/__tests__/masters.concurrency.db.test.ts
const TEST_COMPANY_PREFIX = "標準項目同時投入テスト株式会社";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

describe("標準項目の自動投入(同時実行)", () => {
  it("同時に呼んでも二重に入らない", async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const company = await prisma.company.create({ data: { name: `${TEST_COMPANY_PREFIX}-${suffix}` } });
    await getOrCreateWorkSettings(company.id);
    await Promise.all([1, 2, 3, 4].map(() => ensureDailyReportMasters(company.id)));
    expect(await prisma.workItemMaster.count({ where: { companyId: company.id } })).toBe(24);
    expect(await prisma.machineMaster.count({ where: { companyId: company.id } })).toBe(17);
    expect(await prisma.kyHazardMaster.count({ where: { companyId: company.id } })).toBe(16);
  });
});
