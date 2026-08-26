import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";

export default async function DashboardPage() {
  const user = await requireUser();
  const companyId = user.companyId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    customerCount,
    projectCount,
    quoteCount,
    activeProjectCount,
    estimatingProjectCount,
    confirmedContractCount,
    contractsWithIssuedInvoice,
    issuedInvoiceCount,
    monthlyInvoiceAgg,
    monthlyDailyReportCount,
    monthlyOvertimeAgg,
    expiringQualifications,
  ] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.quote.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId, status: "IN_PROGRESS" } }),
    prisma.project.count({ where: { companyId, status: "ESTIMATING" } }),
    prisma.contract.count({ where: { companyId, status: "CONFIRMED" } }),
    prisma.contract.count({
      where: { companyId, status: "CONFIRMED", invoices: { some: { status: "ISSUED" } } },
    }),
    prisma.invoice.count({ where: { companyId, status: "ISSUED" } }),
    prisma.invoice.aggregate({
      where: { companyId, status: "ISSUED", issueDate: { gte: monthStart, lt: monthEnd } },
      _sum: { total: true },
    }),
    // 依頼文の「AI分析(人工集計・残業時間等の自動集計)」はLLMを使わず単純なSQL集計で実現する
    prisma.dailyReport.count({ where: { companyId, reportDate: { gte: monthStart, lt: monthEnd } } }),
    prisma.dailyReport.aggregate({
      where: { companyId, reportDate: { gte: monthStart, lt: monthEnd } },
      _sum: { overtimeMinutes: true },
    }),
    prisma.employeeQualification.findMany({
      where: { expiresAt: { not: null }, employee: { companyId } },
      include: { employee: { select: { id: true, name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);
  const soonOrExpiredQualifications = expiringQualifications.filter(
    (q) => isExpired(q.expiresAt) || isExpiringSoon(q.expiresAt)
  );
  const unbilledContractCount = confirmedContractCount - contractsWithIssuedInvoice;
  const monthlyBilledAmount = monthlyInvoiceAgg._sum.total ?? 0;
  const monthlyOvertimeHours = Math.round(((monthlyOvertimeAgg._sum.overtimeMinutes ?? 0) / 60) * 10) / 10;

  const cards = [
    { label: "案件数", value: projectCount, href: "/projects", accent: "from-sky-500 to-indigo-500" },
    { label: "見積中", value: estimatingProjectCount, href: "/quotes", accent: "from-violet-500 to-purple-500" },
    { label: "契約済み", value: confirmedContractCount, href: "/contracts", accent: "from-orange-500 to-rose-500" },
    {
      label: "施工中の案件",
      value: activeProjectCount,
      href: "/projects",
      accent: "from-amber-500 to-orange-500",
    },
    { label: "未請求の契約", value: unbilledContractCount, href: "/contracts", accent: "from-rose-500 to-pink-500" },
    { label: "入金待ちの請求書", value: issuedInvoiceCount, href: "/invoices", accent: "from-cyan-500 to-sky-500" },
    { label: "顧客数", value: customerCount, href: "/customers", accent: "from-indigo-500 to-violet-500" },
    { label: "見積数", value: quoteCount, href: "/quotes", accent: "from-emerald-500 to-teal-500" },
    {
      label: "今月の日報件数",
      value: monthlyDailyReportCount,
      href: "/daily-reports",
      accent: "from-lime-500 to-emerald-500",
    },
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50">
          <p className="text-sm text-slate-500">今月の請求金額(発行済み)</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {monthlyBilledAmount.toLocaleString("ja-JP")}円
          </p>
        </Card>
        <Card className="bg-gradient-to-br from-lime-50 to-emerald-50">
          <p className="text-sm text-slate-500">今月の残業時間合計(日報集計)</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{monthlyOvertimeHours}時間</p>
        </Card>
      </div>

      {soonOrExpiredQualifications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-800">⚠ 資格の有効期限が近い従業員がいます</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-800">
            {soonOrExpiredQualifications.map((q) => (
              <li key={q.id}>
                <Link href={`/employees/${q.employee.id}`} className="underline">
                  {q.employee.name}
                </Link>
                : {q.name}(期限 {q.expiresAt?.toLocaleDateString("ja-JP")}
                {isExpired(q.expiresAt) ? " ・期限切れ" : ""})
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-slate-900">はじめに</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>
            <Link href="/customers/new" className="font-medium text-orange-700 underline">
              顧客を登録
            </Link>
            する
          </li>
          <li>
            <Link href="/projects/new" className="font-medium text-orange-700 underline">
              案件を登録
            </Link>
            する
          </li>
          <li>案件から見積・契約書・請求書・日報・施工計画書を作成する</li>
        </ol>
      </Card>
    </div>
  );
}
