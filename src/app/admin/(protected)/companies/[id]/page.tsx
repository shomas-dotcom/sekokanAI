import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import {
  suspendCompanyAction,
  resumeCompanyAction,
  assignCompanyPlanAction,
  addCompanyNoteAction,
} from "../../actions";
import { Card, Textarea, Select, Button, Badge } from "@/components/ui";
import { daysAgo } from "@/lib/dateRange";

const NOTE_TYPE_LABEL: Record<string, string> = { MEETING: "商談", INQUIRY: "問い合わせ" };

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requirePlatformAdmin();

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      _count: { select: { projects: true, quotes: true } },
      pricingPlan: true,
      notes: { orderBy: { createdAt: "desc" }, include: { createdByAdmin: { select: { name: true } } } },
    },
  });
  if (!company) notFound();

  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });

  // 運営者が個社のデータを閲覧した記録を残す(顧客データ閲覧の監査ログ)
  await prisma.platformAdminAuditLog.create({
    data: { adminId: admin.id, action: "company.view", companyId: company.id },
  });

  // 利用状況の集計。将来の継続率・利用率・解約率・AIコスト分析のための最低限の元データ。
  // AIの利用ログ以外は、単純なSQLの件数集計で出す(LLMは使わない)。
  const thirtyDaysAgo = daysAgo(30);
  const cid = company.id;
  const [
    aiUsageTotal,
    aiUsageRecent30d,
    aiUsageFailures30d,
    aiTokenAgg,
    loginTotal,
    loginRecent30d,
    dailyReportTotal,
    dailyReportRecent30d,
    quoteRecent30d,
    invoiceTotal,
    kyTotal,
    auditLogTotal,
    lastActivity,
  ] = await Promise.all([
    prisma.aiUsageLog.count({ where: { companyId: cid } }),
    prisma.aiUsageLog.count({ where: { companyId: cid, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.aiUsageLog.count({
      where: { companyId: cid, createdAt: { gte: thirtyDaysAgo }, success: false },
    }),
    prisma.aiUsageLog.aggregate({
      where: { companyId: cid },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.auditLog.count({
      where: { companyId: cid, action: { in: ["auth.login", "auth.login.google"] } },
    }),
    prisma.auditLog.count({
      where: {
        companyId: cid,
        action: { in: ["auth.login", "auth.login.google"] },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.dailyReport.count({ where: { companyId: cid } }),
    prisma.dailyReport.count({ where: { companyId: cid, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.quote.count({ where: { companyId: cid, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.invoice.count({ where: { companyId: cid } }),
    prisma.kyActivity.count({ where: { companyId: cid } }),
    prisma.auditLog.count({ where: { companyId: cid } }),
    prisma.auditLog.findFirst({
      where: { companyId: cid },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const aiTokensTotal =
    (aiTokenAgg._sum.inputTokens ?? 0) + (aiTokenAgg._sum.outputTokens ?? 0);

  const recentAuditLogs = await prisma.auditLog.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{company.name}</h1>
        {company.isSuspended ? (
          <Badge className="bg-rose-100 text-rose-700">利用停止中</Badge>
        ) : (
          <Badge className="bg-emerald-100 text-emerald-700">利用中</Badge>
        )}
      </div>

      <Card>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">プラン(課金状態)</dt>
            <dd className="font-medium text-slate-900">{company.plan === "PREMIUM" ? "プレミアム" : "無料"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">料金プラン(表示・請求用)</dt>
            <dd className="font-medium text-slate-900">{company.pricingPlan?.name ?? "未割り当て"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">現場数</dt>
            <dd className="font-medium text-slate-900">{company._count.projects}</dd>
          </div>
          <div>
            <dt className="text-slate-500">見積数</dt>
            <dd className="font-medium text-slate-900">{company._count.quotes}</dd>
          </div>
          <div>
            <dt className="text-slate-500">業種</dt>
            <dd className="font-medium text-slate-900">{company.industry ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">登録日</dt>
            <dd className="font-medium text-slate-900">{company.createdAt.toLocaleDateString("ja-JP")}</dd>
          </div>
        </dl>
        {company.isSuspended && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            停止理由: {company.suspendedReason ?? "(未記入)"} / 停止日時:{" "}
            {company.suspendedAt?.toLocaleString("ja-JP")}
          </p>
        )}
      </Card>

      <Card className={company.isSuspended ? undefined : "border-rose-200"}>
        <h2 className="mb-3 font-semibold text-slate-900">利用停止 / 再開</h2>
        {company.isSuspended ? (
          <form action={resumeCompanyAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <Button type="submit">利用を再開する</Button>
          </form>
        ) : (
          <form action={suspendCompanyAction} className="flex flex-col gap-3">
            <input type="hidden" name="companyId" value={company.id} />
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              停止理由(任意、社内記録用)
              <Textarea name="reason" rows={2} />
            </label>
            <Button type="submit" variant="danger" className="w-fit rounded-xl bg-rose-600 px-4 py-2 text-white">
              この会社の利用を停止する
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-slate-900">利用状況</h2>
        <p className="mb-3 text-xs text-slate-500">
          継続率・利用率・解約率・AI原価を後から分析するための元データです。数字はすべて実データの件数集計です。
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          {[
            ["最後の利用", lastActivity ? lastActivity.createdAt.toLocaleString("ja-JP") : "利用なし"],
            ["ログイン回数(累計)", loginTotal],
            ["ログイン回数(30日)", loginRecent30d],
            ["操作回数(累計)", auditLogTotal],
            ["日報作成(累計)", dailyReportTotal],
            ["日報作成(30日)", dailyReportRecent30d],
            ["見積作成(30日)", quoteRecent30d],
            ["請求書作成(累計)", invoiceTotal],
            ["KY作成(累計)", kyTotal],
            ["AI実行回数(累計)", aiUsageTotal],
            ["AI実行回数(30日)", aiUsageRecent30d],
            ["AI失敗回数(30日)", aiUsageFailures30d],
            ["AIトークン数(累計)", aiTokensTotal.toLocaleString()],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          AIトークン数から概算のAPI料金を出す集計は、件数が十分に貯まってから追加します(今は生の件数のみ)。
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">料金プランの割り当て</h2>
        <p className="mb-3 text-sm text-slate-500">
          ここでの割り当ては表示・請求書用の分類です。実際に課金が発生する/しないは上の「プラン(課金状態)」(Stripe連携)側で決まります。
        </p>
        <form action={assignCompanyPlanAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="companyId" value={company.id} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            料金プラン
            <Select name="pricingPlanId" defaultValue={company.pricingPlanId ?? ""}>
              <option value="">未割り当て</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}(月額{plan.monthlyPrice.toLocaleString()}円)
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary">
            割り当てる
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">商談・問い合わせ履歴</h2>
        {company.notes.length === 0 ? (
          <p className="text-sm text-slate-500">まだ記録がありません。</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2 text-sm">
            {company.notes.map((note) => (
              <li key={note.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {NOTE_TYPE_LABEL[note.type]}
                  </span>
                  <span>{note.createdAt.toLocaleString("ja-JP")}</span>
                  <span>{note.createdByAdmin?.name ?? "(不明)"}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
        <form action={addCompanyNoteAction} className="flex flex-col gap-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" name="type" value="MEETING" defaultChecked /> 商談
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" name="type" value="INQUIRY" /> 問い合わせ
            </label>
          </div>
          <Textarea name="content" rows={3} placeholder="例: 無料体験の延長を希望、来週再商談の予定" required />
          <Button type="submit" variant="secondary" className="w-fit">
            記録を追加
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">ユーザー一覧</h2>
        {/* スマホ幅ではテーブルだと横スクロールが発生するため、カード表示にする */}
        <div className="flex flex-col gap-2 sm:hidden">
          {company.users.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-900">
                {u.name}
                {u.deletedAt && <span className="ml-1 text-xs text-slate-400">(退会済み)</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span>{u.email}</span>
                <span>{u.role === "ADMIN" ? "管理者" : "一般社員"}</span>
                <span>最終ログイン: {u.lastLoginAt ? u.lastLoginAt.toLocaleString("ja-JP") : "—"}</span>
              </div>
            </div>
          ))}
        </div>

        <table className="hidden w-full text-left text-sm sm:table">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 pr-2 font-medium">氏名</th>
              <th className="py-2 pr-2 font-medium">メール</th>
              <th className="py-2 pr-2 font-medium">権限</th>
              <th className="py-2 font-medium">最終ログイン</th>
            </tr>
          </thead>
          <tbody>
            {company.users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2">{u.name}{u.deletedAt && <span className="ml-1 text-xs text-slate-400">(退会済み)</span>}</td>
                <td className="py-2 pr-2 text-slate-600">{u.email}</td>
                <td className="py-2 pr-2 text-slate-600">{u.role === "ADMIN" ? "管理者" : "一般社員"}</td>
                <td className="py-2 text-slate-600">
                  {u.lastLoginAt ? u.lastLoginAt.toLocaleString("ja-JP") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">操作ログ(直近20件)</h2>
        {recentAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">まだ記録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-slate-600">
            {recentAuditLogs.map((log) => (
              <li key={log.id}>
                {log.createdAt.toLocaleString("ja-JP")} — {log.user?.name ?? "(不明)"} — {log.action}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
