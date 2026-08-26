import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";

export default async function OnboardingPage() {
  const user = await requireUser();
  const companyId = user.companyId;

  const [company, employeeCount, rateMasterCount, projectCount, dailyReportCount] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.employee.count({ where: { companyId } }),
      prisma.rateMasterItem.count({ where: { companyId } }),
      prisma.project.count({ where: { companyId } }),
      prisma.dailyReport.count({ where: { companyId } }),
    ]);

  const steps = [
    {
      title: "会社情報を確認する",
      body: "住所・電話番号・振込先などを登録すると、見積書・請求書に自動で反映されます。",
      done: Boolean(company.postalCode && company.phone),
      href: "/settings",
      cta: "会社設定を開く",
    },
    {
      title: "従業員を登録する",
      body: "資格の有効期限管理や、現場への作業員割り当てに使います。",
      done: employeeCount > 0,
      href: "/employees/new",
      cta: "従業員を登録する",
    },
    {
      title: "単価を登録する",
      body: "重機・材料・人工などの単価を登録すると、AI見積の下書きに反映されます。",
      done: rateMasterCount > 0,
      href: "/rate-master/new",
      cta: "単価を登録する",
    },
    {
      title: "最初の現場を登録する",
      body: "工事名・発注者・工期などを入力します。",
      done: projectCount > 0,
      href: "/projects/new",
      cta: "現場を登録する",
    },
    {
      title: "AI日報を試す",
      body: "マイクボタンを押して、現場の状況を話してみましょう。",
      done: dailyReportCount > 0,
      href: "/daily-reports/new",
      cta: "日報を作成する",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">はじめに</h1>
        <p className="mt-1 text-sm text-slate-500">
          {doneCount === steps.length
            ? "すべてのステップが完了しました。あとは実際の現場でお使いください。"
            : `あと${steps.length - doneCount}ステップで、ひととおりの機能を体験できます。`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <Card
            key={step.title}
            className={`flex items-center justify-between gap-4 ${step.done ? "border-emerald-200 bg-emerald-50" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{step.title}</p>
                <p className="text-sm text-slate-500">{step.body}</p>
              </div>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-orange-700 shadow-sm hover:bg-slate-50"
              >
                {step.cta}
              </Link>
            )}
          </Card>
        ))}
      </div>

      <Link href="/dashboard" className="text-sm text-slate-500 underline">
        ダッシュボードへ進む
      </Link>
    </div>
  );
}
