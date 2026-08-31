import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui";

export default async function AdminCompaniesPage() {
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { users: true, projects: true } },
      users: { select: { lastLoginAt: true }, orderBy: { lastLoginAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">会社一覧</h1>

      {/* スマホ幅ではテーブルだと横スクロールが発生するため、カード表示にする */}
      <div className="flex flex-col gap-2 sm:hidden">
        {companies.map((c) => {
          const lastLogin = c.users[0]?.lastLoginAt;
          return (
            <Link
              key={c.id}
              href={`/admin/companies/${c.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-orange-700">{c.name}</p>
                {c.isSuspended ? (
                  <Badge className="bg-rose-100 text-rose-700">利用停止中</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700">利用中</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span>{c.plan === "PREMIUM" ? "プレミアム" : "無料"}</span>
                <span>ユーザー数: {c._count.users}</span>
                <span>現場数: {c._count.projects}</span>
                <span>最終ログイン: {lastLogin ? lastLogin.toLocaleDateString("ja-JP") : "—"}</span>
                <span>登録日: {c.createdAt.toLocaleDateString("ja-JP")}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <Card className="hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">会社名</th>
              <th className="px-4 py-3 font-medium">プラン</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">ユーザー数</th>
              <th className="px-4 py-3 font-medium">現場数</th>
              <th className="px-4 py-3 font-medium">最終ログイン</th>
              <th className="px-4 py-3 font-medium">登録日</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const lastLogin = c.users[0]?.lastLoginAt;
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/companies/${c.id}`} className="font-medium text-orange-700 underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.plan === "PREMIUM" ? "プレミアム" : "無料"}</td>
                  <td className="px-4 py-3">
                    {c.isSuspended ? (
                      <Badge className="bg-rose-100 text-rose-700">利用停止中</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">利用中</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c._count.users}</td>
                  <td className="px-4 py-3 text-slate-600">{c._count.projects}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {lastLogin ? lastLogin.toLocaleDateString("ja-JP") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.createdAt.toLocaleDateString("ja-JP")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
