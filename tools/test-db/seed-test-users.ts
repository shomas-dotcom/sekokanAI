// 試験用データベースに、権限・会社分離の確認用アカウントを追加する(本番では絶対に実行しない)。
// 前提: prisma/seed.ts を先に実行し、デモ会社(demo-company)があること。
// 実行: DATABASE_URL を試験用に設定してから npx tsx tools/test-db/seed-test-users.ts
//
// 作るもの(パスワードはすべて test-password-1234 。試験用DB専用の架空アカウント):
//   デモ会社  : member@genba-ai.local(一般社員) / manager@genba-ai.local(現場責任者)
//               従業員マスタ 杉本・田中・佐藤(一般社員は田中に紐付け)
//   B社       : admin-b@genba-ai.local(B社の管理者)と、B社の顧客1件

import { prisma } from "../../src/lib/prisma";
import { hash } from "../../src/lib/password";

const TEST_PASSWORD = "test-password-1234";

function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  // 本番(Neon等)へ誤って書き込まないよう、このパソコン内のDB以外では止める。
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error("DATABASE_URL が試験用(127.0.0.1)ではないため中止しました。");
  }
}

async function main() {
  assertTestDatabase();
  const passwordHash = await hash(TEST_PASSWORD);

  const employees = [];
  for (const name of ["杉本", "田中", "佐藤"]) {
    const id = `test-emp-${name}`;
    employees.push(
      await prisma.employee.upsert({
        where: { id },
        update: {},
        create: { id, companyId: "demo-company", name },
      })
    );
  }

  await prisma.user.upsert({
    where: { email: "member@genba-ai.local" },
    update: {},
    create: {
      companyId: "demo-company",
      email: "member@genba-ai.local",
      passwordHash,
      name: "一般 社員(田中)",
      role: "MEMBER",
      employeeId: employees[1].id,
    },
  });
  await prisma.user.upsert({
    where: { email: "manager@genba-ai.local" },
    update: {},
    create: {
      companyId: "demo-company",
      email: "manager@genba-ai.local",
      passwordHash,
      name: "現場 責任者",
      role: "SITE_MANAGER",
    },
  });

  const companyB = await prisma.company.upsert({
    where: { id: "test-company-b" },
    update: {},
    create: { id: "test-company-b", name: "B社(会社分離の試験用)", plan: "PREMIUM" },
  });
  await prisma.user.upsert({
    where: { email: "admin-b@genba-ai.local" },
    update: {},
    create: { companyId: companyB.id, email: "admin-b@genba-ai.local", passwordHash, name: "B社 管理者", role: "ADMIN" },
  });
  await prisma.customer.upsert({
    where: { id: "test-customer-b" },
    update: {},
    create: { id: "test-customer-b", companyId: companyB.id, name: "B社の顧客(A社から見えてはいけない)" },
  });

  console.log("試験用アカウントを作成しました(パスワード: test-password-1234)。");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
