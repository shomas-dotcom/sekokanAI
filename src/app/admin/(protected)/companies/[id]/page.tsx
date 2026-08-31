import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { suspendCompanyAction, resumeCompanyAction } from "../../actions";
import { Card, Input, Textarea, Button, Badge } from "@/components/ui";

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
    },
  });
  if (!company) notFound();

  // 運営者が個社のデータを閲覧した記録を残す(顧客データ閲覧の監査ログ)
  await prisma.platformAdminAuditLog.create({
    data: { adminId: admin.id, action: "company.view", companyId: company.id },
  });

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
            <dt className="text-slate-500">プラン</dt>
            <dd className="font-medium text-slate-900">{company.plan === "PREMIUM" ? "プレミアム" : "無料"}</dd>
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
