import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";
import { AiIntakeWidget } from "../ai-inbox/AiIntakeWidget";

const AI_DOCUMENT_TYPE_LABEL: Record<string, string> = {
  BUSINESS_CARD: "名刺",
  ESTIMATE_REQUEST: "見積依頼",
  ESTIMATE: "見積書",
  CONTRACT: "契約書",
  INVOICE: "請求書",
  EMPLOYEE_ID: "身分証",
  PROJECT_MESSAGE: "工事の依頼文",
  UNKNOWN: "内容",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const companyId = user.companyId;

  // 「今日の現場」= 施工中の案件。無ければ受注済み・見積中の案件で代用する
  // (依頼文「ログインすると最初に今日の現場を表示する」ため、常に何か表示できるようにする)。
  let todaysProjects = await prisma.project.findMany({
    where: { companyId, status: "IN_PROGRESS" },
    include: { customer: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  if (todaysProjects.length === 0) {
    todaysProjects = await prisma.project.findMany({
      where: { companyId, status: { in: ["CONTRACTED", "ESTIMATING"] } },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
  }

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
      where: {
        companyId,
        status: "CONFIRMED",
        invoices: { some: { status: { in: ["ISSUED", "PAID"] } } },
      },
    }),
    prisma.invoice.count({ where: { companyId, status: "ISSUED" } }),
    prisma.invoice.aggregate({
      // 入金済み(PAID)も「発行済みの請求実績」として当月の請求金額に含める
      where: { companyId, status: { in: ["ISSUED", "PAID"] }, issueDate: { gte: monthStart, lt: monthEnd } },
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

  // 支払期限を過ぎても未入金(ISSUED)の請求書を「入金確認が必要」として警告する
  const overdueInvoices = await prisma.invoice.findMany({
    where: { companyId, status: "ISSUED", dueDate: { lt: now } },
    include: { project: { include: { customer: true } } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  // AIかんたん登録で解析したが、まだ「この内容で登録」を押していないもの
  const pendingAiExtractions = await prisma.aiExtraction.findMany({
    where: { companyId, status: { in: ["REVIEW_REQUIRED", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
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

      {/* ① AIかんたん登録 */}
      <AiIntakeWidget />

      {/* ② AI確認待ち */}
      {pendingAiExtractions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">
            AI確認待ち {pendingAiExtractions.length}件
          </h2>
          <div className="flex flex-col gap-2">
            {pendingAiExtractions.map((ex) => (
              <Link
                key={ex.id}
                href={`/ai-inbox/${ex.id}`}
                className="flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-indigo-800">
                  {ex.status === "FAILED" ? "⚠ 解析に失敗しました" : `${AI_DOCUMENT_TYPE_LABEL[ex.documentType]}を解析しました`}
                  {ex.sourceSummary && <span className="ml-2 text-xs text-indigo-500">({ex.sourceSummary})</span>}
                </span>
                <span className="font-medium text-indigo-700 underline">確認する</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ③ 今日の現場 */}
      <Link
        href="/voice-entry"
        className="flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-5 text-xl font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:scale-[1.01]"
      >
        <span className="text-3xl">🎤</span>
        AIに話す
      </Link>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">今日の現場</h2>
        {todaysProjects.length === 0 ? (
          <Card className="text-center text-sm text-slate-500">
            まだ現場が登録されていません。
            <Link href="/projects/new" className="ml-1 font-medium text-orange-700 underline">
              現場を登録する
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {todaysProjects.map((project) => (
              <Card
                key={project.id}
                className="flex flex-col items-center gap-4 bg-gradient-to-br from-slate-50 to-white sm:flex-row sm:justify-between"
              >
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">{project.customer.name}</p>
                  <p className="text-lg font-bold text-slate-900">{project.name}</p>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Link
                    href={`/voice-entry?projectId=${project.id}`}
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-4xl text-white shadow-lg shadow-indigo-600/40 transition hover:scale-105"
                    aria-label="話して記録する"
                  >
                    🎤
                  </Link>
                  <span className="text-xs font-semibold text-slate-600">話して記録</span>
                  <Link href={`/projects/${project.id}`} className="text-xs font-medium text-slate-500 underline">
                    現場を開く
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ④ 要対応 */}
      {(overdueInvoices.length > 0 || soonOrExpiredQualifications.length > 0) && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">要対応</h2>
          <div className="flex flex-col gap-3">
            {overdueInvoices.length > 0 && (
              <Card className="border-rose-200 bg-rose-50">
                <h3 className="font-semibold text-rose-800">⚠ 入金確認が必要です(支払期限超過)</h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-rose-800">
                  {overdueInvoices.map((inv) => (
                    <li key={inv.id}>
                      <Link href={`/invoices/${inv.id}`} className="underline">
                        {inv.invoiceNumber}
                      </Link>
                      : {inv.project.customer.name} / {inv.total.toLocaleString("ja-JP")}円(期限{" "}
                      {inv.dueDate?.toLocaleDateString("ja-JP")})
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {soonOrExpiredQualifications.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <h3 className="font-semibold text-amber-800">⚠ 資格の有効期限が近い従業員がいます</h3>
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
          </div>
        </div>
      )}

      {/* ⑤ 経営数字 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">経営数字</h2>
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

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">はじめに</h2>
          <Link href="/onboarding" className="text-xs font-medium text-orange-700 underline">
            すべてのステップを見る
          </Link>
        </div>
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
