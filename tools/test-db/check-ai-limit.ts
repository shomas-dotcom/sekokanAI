// AI利用回数の上限が、同時に押された場合も守られるかを試験用DBで確かめる(調査報告F13)。
// 実行: DATABASE_URL を試験用にして npx tsx tools/test-db/check-ai-limit.ts
// 外部のAIは呼ばない(予約と完了の記録だけを試す)。試験後に作った記録は消す。
import { prisma } from "../../src/lib/prisma";
import { finishAiRun, getCompanyAiUsage, reserveAiRun } from "../../src/lib/aiUsageLog";
import { AiLimitReachedError } from "../../src/lib/aiUsageLimit";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("試験用DB(127.0.0.1)以外では実行しません。");

  process.env.AI_MONTHLY_LIMIT_PER_COMPANY = "3";
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo@genba-ai.local" } });
  const ctx = { companyId: user.companyId, userId: user.id, feature: "test.aiLimit" };
  await prisma.aiUsageLog.deleteMany({ where: { feature: "test.aiLimit" } });

  // 6件を同時に予約 → 上限3なので3件だけ通るはず
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => reserveAiRun(ctx, "test-model")));
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<string>).value);
  const blocked = results.filter((r) => r.status === "rejected" && r.reason instanceof AiLimitReachedError).length;
  const other = results.filter((r) => r.status === "rejected" && !(r.reason instanceof AiLimitReachedError));
  console.log(`同時6件 → 通過 ${ok.length}件 / 上限で停止 ${blocked}件 / その他の失敗 ${other.length}件`);
  for (const o of other) console.log("  その他:", (o as PromiseRejectedResult).reason);

  // 1件を「AI呼び出し失敗」で完了 → 失敗は数えないので、もう1件使えるはず
  await finishAiRun(ok[0], ctx, { model: "test-model", success: false, errorMessage: "試験" });
  await finishAiRun(ok[1], ctx, { model: "test-model", success: true });
  await finishAiRun(ok[2], ctx, { model: "test-model", success: true });
  console.log("1件を失敗として完了後の利用状況:", await getCompanyAiUsage(ctx.companyId));
  const again = await reserveAiRun(ctx, "test-model").then(() => "通過", (e) => (e instanceof AiLimitReachedError ? "停止" : String(e)));
  const againAfterFull = await reserveAiRun(ctx, "test-model").then(() => "通過", (e) => (e instanceof AiLimitReachedError ? "停止" : String(e)));
  console.log(`失敗分の再利用 → ${again} / その次 → ${againAfterFull}`);

  const pass = ok.length === 3 && blocked === 3 && other.length === 0 && again === "通過" && againAfterFull === "停止";
  console.log(pass ? "合格" : "不合格");
  await prisma.aiUsageLog.deleteMany({ where: { feature: "test.aiLimit" } });
  if (!pass) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
