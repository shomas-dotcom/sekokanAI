import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering";

// 採番(NumberSequence)の重複防止をトランザクションで保証できているかを確認する
// 結合テスト。Postgres移行後は開発用DB(.envのDATABASE_URL)に直接接続して検証し、
// このテストが作った会社(名前が「採番テスト」で始まるもの)だけを終了後に削除する
// (dev.dbへの分離用一時SQLiteファイルは廃止。Postgresでは同等の使い捨てDBを都度
// 作るコストが高いため、既存の開発用DBを使い、後片付けで汚さない方針にした)。
const TEST_COMPANY_PREFIX = "採番テスト株式会社";

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
});

async function createTestCompany(name: string) {
  return prisma.company.create({ data: { name } });
}

describe("nextDocumentNumber", () => {
  it("同一会社・同一書類種別で連番を発行する", async () => {
    const company = await createTestCompany(`${TEST_COMPANY_PREFIX}A`);
    const first = await nextDocumentNumber(company.id, "ESTIMATE");
    const second = await nextDocumentNumber(company.id, "ESTIMATE");
    const year = new Date().getFullYear();
    expect(first).toBe(`EST-${year}-0001`);
    expect(second).toBe(`EST-${year}-0002`);
  });

  it("同時に採番しても番号が重複しない", async () => {
    const company = await createTestCompany(`${TEST_COMPANY_PREFIX}B`);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => nextDocumentNumber(company.id, "INVOICE"))
    );
    expect(new Set(results).size).toBe(10);
  });

  it("会社が異なれば連番は独立してカウントされる", async () => {
    const companyA = await createTestCompany(`${TEST_COMPANY_PREFIX}C`);
    const companyB = await createTestCompany(`${TEST_COMPANY_PREFIX}D`);
    const numberA = await nextDocumentNumber(companyA.id, "CONTRACT");
    const numberB = await nextDocumentNumber(companyB.id, "CONTRACT");
    const year = new Date().getFullYear();
    expect(numberA).toBe(`CON-${year}-0001`);
    expect(numberB).toBe(`CON-${year}-0001`);
  });
});
