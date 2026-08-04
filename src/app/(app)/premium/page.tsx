import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPremium } from "@/lib/premium";
import { Card, Badge, Button } from "@/components/ui";
import { PREMIUM_FEATURES } from "./features";
import { togglePlanAction } from "./actions";

export default async function PremiumPage() {
  const user = await requireUser();
  const premium = isPremium(user.company);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AIプレミアム</h1>
        <p className="mt-1 text-sm text-slate-500">
          工事マスター(案件情報)を活用し、ボタン1つでAIが各種書類の下書きを作成します。
        </p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-indigo-100 bg-indigo-50/50">
        <div>
          <p className="text-sm font-semibold text-indigo-900">
            現在のプラン: {premium ? "AIプレミアム" : "無料プラン"}
          </p>
          <p className="mt-1 text-xs text-indigo-700">
            {premium
              ? "AIプレミアム機能をご利用いただけます。"
              : "AIプレミアムにアップグレードすると下記機能が利用できます。"}
          </p>
        </div>
        {user.role === "ADMIN" ? (
          <form action={togglePlanAction}>
            <Button variant={premium ? "secondary" : "ai"}>
              {premium ? "無料プランに戻す(デモ)" : "AIプレミアムを有効にする(デモ)"}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-indigo-600">プラン変更は管理者にご依頼ください。</p>
        )}
      </Card>
      <p className="text-xs text-slate-400">
        ※ デモ用のプラン切替です。実際の決済・請求は行われません(本番では決済サービス経由で更新します)。
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {PREMIUM_FEATURES.map((f) => (
          <Card key={f.key} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-900">{f.title}</p>
              {f.href ? (
                <Badge className="bg-emerald-50 text-emerald-700">利用可能</Badge>
              ) : (
                <Badge>近日提供</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600">{f.description}</p>
            <p className="text-xs text-slate-500">メリット: {f.benefit}</p>
            <p className="text-xs text-slate-500">時間短縮効果: {f.timeSaved}</p>
            {f.href ? (
              <Link href={f.href} className="mt-2">
                <Button variant="ai" className="w-full">
                  利用開始
                </Button>
              </Link>
            ) : (
              <Button variant="secondary" disabled className="mt-2 w-full">
                近日提供
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
