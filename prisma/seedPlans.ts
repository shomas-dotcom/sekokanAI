import { prisma } from "../src/lib/prisma";

// 現場AIの初期料金プランを投入する。2026-09-26 事業者決定で「ライト 月額9,800円(税込)」のみ。
// (以前あったスタンダード/プロは、既存DBでは消さずに「新規契約の選択肢に表示しない」にしている)
// key(コードから安定して参照するための識別子)でupsertするため、何度実行しても
// 既存プランを壊さない。金額は運営者が管理画面(/admin/plans)からいつでも変更できる —
// ここでの値はあくまで初期値。
const PLANS = [
  { key: "light", name: "ライト", monthlyPrice: 9_800, setupFee: 0, sortOrder: 1 },
] as const;

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {}, // 既に存在する場合は上書きしない(運営者が管理画面で変更済みの値を壊さないため)
      create: plan,
    });
  }
  console.log("Seed complete: plans =", PLANS.map((p) => p.key).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
