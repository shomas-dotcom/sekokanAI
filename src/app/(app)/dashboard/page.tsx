import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const companyId = user.companyId;

  const [customerCount, projectCount, quoteCount, activeProjectCount] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.quote.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId, status: "IN_PROGRESS" } }),
  ]);

  const cards = [
    { label: "顧客数", value: customerCount, href: "/customers", accent: "from-indigo-500 to-violet-500" },
    { label: "案件数", value: projectCount, href: "/projects", accent: "from-sky-500 to-indigo-500" },
    {
      label: "施工中の案件",
      value: activeProjectCount,
      href: "/projects",
      accent: "from-amber-500 to-orange-500",
    },
    { label: "見積数", value: quoteCount, href: "/quotes", accent: "from-emerald-500 to-teal-500" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-slate-500">{user.company.name} の概況</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${card.accent} opacity-15 blur-xl transition group-hover:opacity-25`}
            />
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">はじめに</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>
            <Link href="/customers/new" className="font-medium text-indigo-600 underline">
              顧客を登録
            </Link>
            する
          </li>
          <li>
            <Link href="/projects/new" className="font-medium text-indigo-600 underline">
              案件を登録
            </Link>
            する
          </li>
          <li>案件から見積・日報・施工計画書を作成する</li>
        </ol>
      </Card>
    </div>
  );
}
