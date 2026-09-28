// 試験用DBで、デモ会社のAI上限と今月の利用回数を好きな値にする(画面の警告表示の確認用)。
// 実行: npx tsx tools/test-db/set-ai-usage.ts <上限> <利用回数>   例: 5 4
// 利用回数は feature="test.fakeUsage" の架空の記録で作り、実行のたびに作り直す。
import { prisma } from "../../src/lib/prisma";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("試験用DB(127.0.0.1)以外では実行しません。");
  const limit = Number(process.argv[2]);
  const used = Number(process.argv[3]);

  const plan = await prisma.plan.upsert({
    where: { key: "test-ai-limit" },
    update: { aiRunLimit: limit },
    create: { key: "test-ai-limit", name: "試験用(AI上限)", monthlyPrice: 0, aiRunLimit: limit, isActive: false },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo@genba-ai.local" } });
  await prisma.company.update({ where: { id: user.companyId }, data: { pricingPlanId: plan.id } });

  await prisma.aiUsageLog.deleteMany({ where: { feature: "test.fakeUsage" } });
  await prisma.aiUsageLog.createMany({
    data: Array.from({ length: used }, () => ({
      companyId: user.companyId,
      userId: user.id,
      feature: "test.fakeUsage",
      model: "test-model",
      success: true,
    })),
  });
  console.log(`デモ会社: 上限 ${limit}回 / 今月の利用 ${used}回 に設定しました。`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
