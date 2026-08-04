import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    { label: "顧客数", value: customerCount, href: "/customers" },
    { label: "案件数", value: projectCount, href: "/projects" },
    { label: "施工中の案件", value: activeProjectCount, href: "/projects" },
    { label: "見積数", value: quoteCount, href: "/quotes" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.company.name} の概況</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400"
          >
            <p className="text-2xl font-bold text-zinc-900">{card.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold text-zinc-900">はじめに</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-600">
          <li>
            <Link href="/customers/new" className="underline">
              顧客を登録
            </Link>
            する
          </li>
          <li>
            <Link href="/projects/new" className="underline">
              案件を登録
            </Link>
            する
          </li>
          <li>案件から見積・日報・施工計画書を作成する</li>
        </ol>
      </div>
    </div>
  );
}
