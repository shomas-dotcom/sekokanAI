import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { Card, Badge } from "@/components/ui";
import { SUBSCRIPTION_STATUS_LABEL } from "./statusLabel";
import { StartSubscriptionForm, BillingPortalForm } from "./BillingForms";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; mock?: string }>;
}) {
  const { checkout, mock } = await searchParams;
  const user = await requireUser();
  const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
  const events = await prisma.billingEvent.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const configured = isStripeConfigured();
  const status = company.subscriptionStatus;
  const hasActiveOrTrial = status === "trialing" || status === "active";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">ご契約状況</h1>

      {checkout === "success" && (
        <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          お申し込みありがとうございます。反映まで少し時間がかかる場合があります。
        </Card>
      )}
      {checkout === "cancelled" && (
        <Card className="border-slate-200 bg-slate-50 text-sm text-slate-600">
          お申し込みを中断しました。いつでもやり直せます。
        </Card>
      )}
      {mock === "trialStarted" && (
        <Card className="border-indigo-200 bg-indigo-50 text-sm text-indigo-800">
          開発用の疑似トライアルを開始しました(実際の課金は発生していません)。Stripeを設定すると、実際の決済に切り替わります。
        </Card>
      )}
      {!configured && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">
          Stripeが未設定のため、下のボタンは開発用の疑似トライアル(無課金)として動作します。実際に課金を行うには、環境変数
          STRIPE_SECRET_KEY / STRIPE_PRICE_ID / STRIPE_WEBHOOK_SECRET の設定が必要です。
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">現在の状態</p>
          <Badge className={hasActiveOrTrial ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
            {status ? (SUBSCRIPTION_STATUS_LABEL[status] ?? status) : "未契約"}
          </Badge>
        </div>
        {company.trialEndsAt && status === "trialing" && (
          <p className="mt-2 text-sm text-slate-600">
            無料体験期限: {company.trialEndsAt.toLocaleDateString("ja-JP")}
          </p>
        )}
        {company.currentPeriodEnd && (
          <p className="mt-1 text-sm text-slate-600">
            次回更新日: {company.currentPeriodEnd.toLocaleDateString("ja-JP")}
            {company.cancelAtPeriodEnd && "(この期日で解約予定)"}
          </p>
        )}

        {user.role !== "ADMIN" ? (
          <p className="mt-4 text-sm text-slate-500">契約内容の変更は管理者にご依頼ください。</p>
        ) : hasActiveOrTrial ? (
          <BillingPortalForm disabled={!configured} />
        ) : (
          <StartSubscriptionForm />
        )}
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-slate-900">請求履歴</h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">まだ記録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-slate-600">
            {events.map((e) => (
              <li key={e.id}>
                {e.createdAt.toLocaleString("ja-JP")} — {e.summary ?? e.type}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
