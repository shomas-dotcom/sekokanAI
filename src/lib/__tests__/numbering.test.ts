import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 採番(NumberSequence)の重複防止をトランザクションで保証できているかを確認する
// 結合テスト。dev.dbを汚さないよう、専用の一時SQLiteファイルにマイグレーションを
// 適用して検証する(テスト後に削除する)。
const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
const testDbPath = path.join(projectRoot, "test.db");
const testDatabaseUrl = "file:./test.db";

let prismaModule: typeof import("@/lib/prisma");
let numberingModule: typeof import("@/lib/numbering");

beforeAll(async () => {
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  } catch {
    /* 前回実行分が残っていても、テストはcompanyId単位で独立しているため問題ない */
  }
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = testDatabaseUrl;
  prismaModule = await import("@/lib/prisma");
  numberingModule = await import("@/lib/numbering");
}, 60_000);

afterAll(async () => {
  await prismaModule.prisma.$disconnect();
  // Windows ではハンドル解放に時間差があり削除に失敗することがあるため、
  // 後始末の失敗はテスト結果に影響させない(test.dbはgitignore対象)。
  try {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  } catch {
    /* ignore cleanup failure */
  }
});

async function createTestCompany(name: string) {
  return prismaModule.prisma.company.create({ data: { name } });
}

describe("nextDocumentNumber", () => {
  it("同一会社・同一書類種別で連番を発行する", async () => {
    const company = await createTestCompany("採番テスト株式会社A");
    const first = await numberingModule.nextDocumentNumber(company.id, "ESTIMATE");
    const second = await numberingModule.nextDocumentNumber(company.id, "ESTIMATE");
    const year = new Date().getFullYear();
    expect(first).toBe(`EST-${year}-0001`);
    expect(second).toBe(`EST-${year}-0002`);
  });

  it("同時に採番しても番号が重複しない", async () => {
    const company = await createTestCompany("採番テスト株式会社B");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => numberingModule.nextDocumentNumber(company.id, "INVOICE"))
    );
    expect(new Set(results).size).toBe(10);
  });

  it("会社が異なれば連番は独立してカウントされる", async () => {
    const companyA = await createTestCompany("採番テスト株式会社C");
    const companyB = await createTestCompany("採番テスト株式会社D");
    const numberA = await numberingModule.nextDocumentNumber(companyA.id, "CONTRACT");
    const numberB = await numberingModule.nextDocumentNumber(companyB.id, "CONTRACT");
    const year = new Date().getFullYear();
    expect(numberA).toBe(`CON-${year}-0001`);
    expect(numberB).toBe(`CON-${year}-0001`);
  });
});
