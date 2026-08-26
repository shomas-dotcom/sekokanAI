import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function AdminDashboardPage() {
  const [companyCount, premiumCount, suspendedCount, userCount, recentAdminActions] =
    await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { plan: "PREMIUM" } }),
      prisma.company.count({ where: { isSuspended: true } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.platformAdminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  const cards = [
    { label: "登録会社数", value: companyCount },
    { label: "AIプレミアム有効な会社数", value: premiumCount },
    { label: "利用停止中の会社数", value: suspendedCount },
    { label: "利用ユーザー数(退会除く)", value: userCount },
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

      <Card className="border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-800">
          MRR・無料体験数・解約率・AI使用量・エラー件数は表示できません
        </p>
        <p className="mt-1 text-sm text-amber-700">
          これらは決済(Stripe)連携と実際のAI API利用が始まってから正しい値を出せる項目です。まだ実装していないため、数字を作らずここに表示しないでおきます。決済連携(Phase 8)が完了次第、追加します。
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
