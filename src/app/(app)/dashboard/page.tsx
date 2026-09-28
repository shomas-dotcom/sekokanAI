import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";
import { AiIntakeWidget } from "../ai-inbox/AiIntakeWidget";
import { getCompanyAiUsage } from "@/lib/aiUsageLog";

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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const [
    projectCount,
    activeProjectCount,
    estimatingProjectCount,
    confirmedContractCount,
    contractsWithIssuedInvoice,
    issuedInvoiceCount,
    monthlyInvoiceAgg,
    monthlyOvertimeAgg,
    monthlyAttendanceOvertimeAgg,
    todayAttendanceCount,
    unapprovedAttendanceCount,
    monthlyManDaysAgg,
    expiringQualifications,
  ] = await Promise.all([
    // 会社が登録したばかりかどうかの判定(「はじめに」カードの表示要否)に使う
    prisma.project.count({ where: { companyId } }),
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
    prisma.dailyReport.aggregate({
      where: { companyId, reportDate: { gte: monthStart, lt: monthEnd } },
      _sum: { overtimeMinutes: true },
    }),
    prisma.attendance.aggregate({
      where: {
        companyId,
        targetDate: { gte: monthStart, lt: monthEnd },
        status: { in: ["APPROVED", "CLOSED"] },
      },
      _sum: { overtimeMinutes: true },
      _count: true,
    }),
    prisma.attendance.count({
      where: { companyId, targetDate: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.attendance.count({ where: { companyId, status: "SUBMITTED" } }),
    prisma.siteAttendance.aggregate({
      where: { companyId, targetDate: { gte: monthStart, lt: monthEnd } },
      _sum: { manDays: true },
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

  // 勤怠機能の移行期間: 承認済み(または締め済み)の勤怠が1件でもあればそちらを正とし、
  // まだ無ければ従来どおり日報の残業時間集計を使う(同じ時間を二重に数えないよう、
  // どちらか一方だけを採用する)。
  const useAttendanceForOvertime = monthlyAttendanceOvertimeAgg._count > 0;
  const monthlyOvertimeHours = useAttendanceForOvertime
    ? Math.round(((monthlyAttendanceOvertimeAgg._sum.overtimeMinutes ?? 0) / 60) * 10) / 10
    : Math.round(((monthlyOvertimeAgg._sum.overtimeMinutes ?? 0) / 60) * 10) / 10;
  const monthlyManDays = monthlyManDaysAgg._sum.manDays ?? 0;

  const monthlyBillableAgg =
    user.role === "ADMIN"
      ? await prisma.siteAttendance.aggregate({
          where: { companyId, targetDate: { gte: monthStart, lt: monthEnd }, isBillable: true },
          _sum: { amount: true },
        })
      : null;
  const monthlyBillableAmount = monthlyBillableAgg?._sum.amount ?? 0;

  // AI利用回数の上限(F13)。上限に近づいた時だけ知らせる(普段は数字を増やさない方針のため)。
  const aiUsage = await getCompanyAiUsage(companyId);
  const aiUsageWarning =
    aiUsage.limit != null && aiUsage.used >= Math.floor(aiUsage.limit * 0.8)
      ? aiUsage.used >= aiUsage.limit
        ? `今月のAI利用回数が上限(${aiUsage.limit}回)に達しました。AIを使う機能は、来月まで簡易判定で動くか、手入力になります。`
        : `今月のAI利用回数が上限に近づいています(${aiUsage.used} / ${aiUsage.limit}回)。`
      : null;

  // 「見て困らない数字」は絞る。ここに残すのは「今なにか対応が必要か」が
  // 一目でわかる4つだけにする(それ以外は各一覧画面で見られる)。
  const cards = [
    { label: "施工中の案件", value: activeProjectCount, href: "/projects", dot: "bg-amber-500" },
    { label: "見積中", value: estimatingProjectCount, href: "/quotes", dot: "bg-violet-500" },
    { label: "未請求の契約", value: unbilledContractCount, href: "/contracts", dot: "bg-rose-500" },
    { label: "入金待ちの請求書", value: issuedInvoiceCount, href: "/invoices", dot: "bg-sky-500" },
  ];

  const hour = now.getHours();
  const greeting = hour < 5 ? "お疲れ様です" : hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "お疲れ様です";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">{greeting}、{user.name}さん</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{user.company.name}</h1>
      </div>

      {aiUsageWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ {aiUsageWarning}
        </p>
      )}

      {/* AIヒーロー領域: 音声入力とかんたん登録を1か所にまとめ、ここだけ色を効かせて目立たせる */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 shadow-lg shadow-indigo-600/25">
        <Link
          href="/voice-entry"
          className="flex items-center justify-center gap-3 rounded-2xl bg-white/15 px-6 py-5 text-xl font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          <span className="text-3xl">🎤</span>
          AIに話す
        </Link>
        <p className="mt-4 text-sm font-medium text-white/80">写真・書類でかんたん登録</p>
        <div className="mt-2">
          <AiIntakeWidget />
        </div>
      </div>

      {/* AI確認待ち */}
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
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
              >
                <span className="text-slate-700">
                  {ex.status === "FAILED" ? "⚠ 解析に失敗しました" : `${AI_DOCUMENT_TYPE_LABEL[ex.documentType]}を解析しました`}
                  {ex.sourceSummary && <span className="ml-2 text-xs text-slate-400">({ex.sourceSummary})</span>}
                </span>
                <span className="font-medium text-indigo-700">確認する →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
          <div className="flex flex-col gap-2">
            {todaysProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
              >
                <div>
                  <p className="text-xs text-slate-500">{project.customer.name}</p>
                  <p className="font-bold text-slate-900">{project.name}</p>
                </div>
                <span className="text-sm font-medium text-orange-700">開く →</span>
              </Link>
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

      {/* 経営数字 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">経営数字</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${card.dot}`} />
              <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
              <p className="mt-1 text-sm text-slate-500">{card.label}</p>
            </Link>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">今月の請求金額(発行済み)</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">
              {monthlyBilledAmount.toLocaleString("ja-JP")}円
            </p>
          </Card>
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">
              今月の残業時間合計({useAttendanceForOvertime ? "勤怠集計" : "日報集計"})
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{monthlyOvertimeHours}時間</p>
          </Card>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/attendance-management"
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <p className="text-2xl font-bold text-slate-900">{todayAttendanceCount}</p>
            <p className="mt-1 text-sm text-slate-500">今日の出勤人数</p>
          </Link>
          <Link
            href="/attendance-management"
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <p className="text-2xl font-bold text-slate-900">{unapprovedAttendanceCount}</p>
            <p className="mt-1 text-sm text-slate-500">未承認の勤怠</p>
          </Link>
          <Link
            href="/site-attendance"
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <p className="text-2xl font-bold text-slate-900">{monthlyManDays}</p>
            <p className="mt-1 text-sm text-slate-500">今月の総人工</p>
          </Link>
          {user.role === "ADMIN" && (
            <Link
              href="/site-attendance"
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
            >
              <p className="text-2xl font-bold text-slate-900">{monthlyBillableAmount.toLocaleString("ja-JP")}円</p>
              <p className="mt-1 text-sm text-slate-500">今月の常用請求予定額</p>
            </Link>
          )}
        </div>
      </div>

      {/* 案件が1件も無い、登録したばかりの会社にだけ案内を出す(慣れた会社には表示しない) */}
      {projectCount === 0 && (
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
      )}
    </div>
  );
}
