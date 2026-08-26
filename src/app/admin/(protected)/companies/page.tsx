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

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
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
