import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { daysAgo } from "@/lib/dateRange";

export default async function AdminDashboardPage() {
  const thirtyDaysAgo = daysAgo(30);
  const sevenDaysAgo = daysAgo(7);
  const [
    companyCount,
    premiumCount,
    suspendedCount,
    userCount,
    recentAdminActions,
    payingCompanies,
    aiUsageRecent30d,
    aiUsageFailures30d,
    activeCompanies7d,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { plan: "PREMIUM" } }),
    prisma.company.count({ where: { isSuspended: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.platformAdminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    // MRR(月間経常収益)は「実際に課金状態(プレミアム)かつ、料金プランが割り当て済み」の
    // 会社だけを対象に、そのプランの月額を合計して出す。捏造した数字を出さないため、
    // どちらか一方でも欠けている会社は合計に含めない。
    prisma.company.findMany({
      where: { plan: "PREMIUM", pricingPlanId: { not: null } },
      select: { pricingPlan: { select: { monthlyPrice: true } } },
    }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: thirtyDaysAgo }, success: false } }),
    // 直近7日に何らかの操作(ログイン・登録・作成等)があった会社数 = 実際に使われている会社数
    prisma.auditLog
      .findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { companyId: true },
        distinct: ["companyId"],
      })
      .then((rows) => rows.length),
  ]);

  const mrr = payingCompanies.reduce((sum, c) => sum + (c.pricingPlan?.monthlyPrice ?? 0), 0);
  const arr = mrr * 12;
  const unassignedPaidCount = premiumCount - payingCompanies.length;

  const cards = [
    { label: "登録会社数", value: companyCount },
    { label: "直近7日に使われた会社数", value: activeCompanies7d },
    { label: "AIプレミアム有効な会社数", value: premiumCount },
    { label: "利用停止中の会社数", value: suspendedCount },
    { label: "利用ユーザー数(退会除く)", value: userCount },
    { label: "MRR(月間経常収益)", value: `${mrr.toLocaleString()}円` },
    { label: "ARR(年間換算)", value: `${arr.toLocaleString()}円` },
    { label: "AI実行回数(全社・直近30日)", value: aiUsageRecent30d },
    { label: "AI失敗回数(全社・直近30日)", value: aiUsageFailures30d },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">概況</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="mt-1 text-sm text-slate-500">{c.label}</p>
          </Card>
        ))}
      </div>

      {unassignedPaidCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">
            MRRに含まれていない有料会社が{unassignedPaidCount}社あります
          </p>
          <p className="mt-1 text-sm text-amber-700">
            プレミアム契約中でも「料金プラン」が未割り当ての会社はMRR計算に含めていません(勝手に金額を推測しないため)。各社の詳細画面から料金プランを割り当ててください。
          </p>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-800">
          無料体験数・解約率・サーバー費用・粗利益はまだ表示できません
        </p>
        <p className="mt-1 text-sm text-amber-700">
          無料体験の期限管理と、AIトークン数からの概算API料金の計算が実装されてから正しい値を出せる項目です。まだ実装していないため、数字を作らずここに表示しないでおきます(会社ごとの生の利用件数は各社の詳細画面で確認できます)。
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">運営者の操作ログ(直近10件)</h2>
        {recentAdminActions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">まだ操作はありません。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
            {recentAdminActions.map((a) => (
              <li key={a.id}>
                {a.createdAt.toLocaleString("ja-JP")} — {a.action}
                {a.companyId && ` (会社ID: ${a.companyId})`}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
