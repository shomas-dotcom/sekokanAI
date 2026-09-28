// 保存容量の上限が試験用DBで正しく判定されるかを確かめる(調査報告F13)。
// 実行: npx tsx tools/test-db/check-storage-limit.ts
// 試験後、デモ会社の上限は元(無制限)に戻す。
import { prisma } from "../../src/lib/prisma";
import { checkStorageForUpload, companyStorageUsedBytes } from "../../src/lib/companyLimits";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("試験用DB(127.0.0.1)以外では実行しません。");
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "demo@genba-ai.local" } });
  const plan = await prisma.plan.upsert({
    where: { key: "test-ai-limit" },
    update: {},
    create: { key: "test-ai-limit", name: "試験用(上限)", monthlyPrice: 0, isActive: false },
  });
  await prisma.company.update({ where: { id: admin.companyId }, data: { pricingPlanId: plan.id } });
  const used = await companyStorageUsedBytes(prisma, admin.companyId);
  const MB = 1024 * 1024;

  const cases: { label: string; limitMb: number | null; incoming: number; expectBlocked: boolean }[] = [
    { label: "上限なし・10MB追加", limitMb: null, incoming: 10 * MB, expectBlocked: false },
    { label: "上限0MB・1バイト追加", limitMb: 0, incoming: 1, expectBlocked: true },
    { label: "上限1MB・少しだけ追加", limitMb: 1, incoming: 1024, expectBlocked: used + 1024 > MB },
    { label: "上限1MB・2MB追加", limitMb: 1, incoming: 2 * MB, expectBlocked: true },
  ];
  let pass = true;
  for (const c of cases) {
    await prisma.plan.update({ where: { id: plan.id }, data: { storageLimitMb: c.limitMb } });
    const message = await checkStorageForUpload(admin.companyId, c.incoming);
    const ok = Boolean(message) === c.expectBlocked;
    pass &&= ok;
    console.log(`${ok ? "OK " : "NG "} ${c.label} → ${message ?? "保存できる"}`);
  }
  await prisma.plan.update({ where: { id: plan.id }, data: { storageLimitMb: null, userLimit: null, aiRunLimit: null } });
  console.log(`使用中 ${(used / MB).toFixed(3)}MB / ${pass ? "合格" : "不合格"}`);
  if (!pass) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
