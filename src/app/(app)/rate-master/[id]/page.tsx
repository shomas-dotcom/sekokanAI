import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RateMasterItemForm } from "../RateMasterItemForm";
import { updateRateMasterItemAction, deleteRateMasterItemAction } from "../actions";
import { Card, Button } from "@/components/ui";
import { isRateStale } from "@/lib/rateMaster";

export default async function RateMasterItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const item = await prisma.rateMasterItem.findFirst({ where: { id, companyId: user.companyId } });
  if (!item) notFound();

  const history = await prisma.rateMasterPriceHistory.findMany({
    where: { rateMasterItemId: id, companyId: user.companyId },
    orderBy: { effectiveDate: "desc" },
    include: { sourceQuote: { select: { title: true, estimateNumber: true } } },
  });
  const lastPriceDate = history[0]?.effectiveDate ?? item.updatedAt;
  const stale = isRateStale(lastPriceDate);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{item.name}</h1>

      {stale && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠ この単価は{lastPriceDate.toLocaleDateString("ja-JP")}から3ヶ月以上更新されていません。最新の単価を確認してください。
        </div>
      )}

      <Card className="max-w-lg">
        <RateMasterItemForm action={updateRateMasterItemAction} item={item} submitLabel="更新する" />
      </Card>

      <Card className="max-w-lg">
        <h2 className="font-semibold text-slate-900">単価履歴</h2>
        <p className="mt-1 text-xs text-slate-500">
          単価は上書きせず、変更のたびにここへ記録が積み重なります。
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">まだ履歴がありません。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {h.unitPrice.toLocaleString("ja-JP")}円
                    {h.costPrice != null && (
                      <span className="ml-2 text-xs text-slate-500">
                        (原価{h.costPrice.toLocaleString("ja-JP")}円)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {h.effectiveDate.toLocaleDateString("ja-JP")}
                    {h.sourceQuote && ` ・参考元: ${h.sourceQuote.estimateNumber ?? h.sourceQuote.title}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form action={deleteRateMasterItemAction} className="max-w-lg">
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="danger">
          この単価を削除する
        </Button>
      </form>
    </div>
  );
}
