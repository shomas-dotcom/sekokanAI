// 試験用DBで、デモ会社の利用者数・保存容量の上限を設定し、現在の使用量を表示する(画面確認用)。
// 実行: npx tsx tools/test-db/set-company-limits.ts <利用者数の上限|-> <容量MBの上限|->   例: 3 0
// 「-」は無制限(null)。上限は試験用プラン(test-ai-limit)に書き、デモ会社をそのプランにする。
import { prisma } from "../../src/lib/prisma";
import { companyStorageUsedBytes } from "../../src/lib/companyLimits";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("試験用DB(127.0.0.1)以外では実行しません。");
  const toLimit = (raw: string | undefined) => (raw == null || raw === "-" ? null : Number(raw));
  const userLimit = toLimit(process.argv[2]);
  const storageLimitMb = toLimit(process.argv[3]);

  const plan = await prisma.plan.upsert({
    where: { key: "test-ai-limit" },
    update: { userLimit, storageLimitMb },
    create: { key: "test-ai-limit", name: "試験用(上限)", monthlyPrice: 0, userLimit, storageLimitMb, isActive: false },
  });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "demo@genba-ai.local" } });
  await prisma.company.update({ where: { id: admin.companyId }, data: { pricingPlanId: plan.id } });

  const activeUsers = await prisma.user.count({ where: { companyId: admin.companyId, deletedAt: null } });
  const usedBytes = await companyStorageUsedBytes(prisma, admin.companyId);
  console.log(
    `デモ会社: 利用者 ${activeUsers}人(上限 ${userLimit ?? "無制限"}) / 保存容量 ${(usedBytes / 1024 / 1024).toFixed(2)}MB(上限 ${storageLimitMb ?? "無制限"}MB)`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
