import { prisma } from "../src/lib/prisma";
import { hash } from "../src/lib/password";

// デモ用アカウント。パスワードは開発用のダミー値 — 本番では使用しないこと。
async function main() {
  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    // 既存デモ会社はフリーミアム導入前からプレミアム機能(見積・施工計画書)を
    // 利用していたため、挙動を変えないようPREMIUMへ移行する。新規登録はFREEが既定。
    update: { plan: "PREMIUM" },
    create: {
      id: "demo-company",
      name: "杉本土木株式会社(デモ)",
      address: "埼玉県坂戸市デモ1-2-3",
      representativeName: "デモ 代表",
      licenseNumber: "デモ-000000",
      plan: "PREMIUM",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@genba-ai.local" },
    update: {},
    create: {
      companyId: company.id,
      email: "demo@genba-ai.local",
      passwordHash: await hash("demo-password-change-me"),
      name: "デモ 太郎",
      role: "ADMIN",
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer" },
    update: {},
    create: {
      id: "demo-customer",
      companyId: company.id,
      name: "デモ発注者株式会社",
      contactName: "発注 花子",
      phone: "049-000-0000",
    },
  });

  await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {},
    create: {
      id: "demo-project",
      companyId: company.id,
      customerId: customer.id,
      name: "デモ工事(道路築造等工事)",
      siteAddress: "埼玉県坂戸市デモ地内",
      orderingParty: "デモ市",
      status: "IN_PROGRESS",
    },
  });

  console.log("Seed complete:", { companyId: company.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
