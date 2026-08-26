import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { KyItem } from "@/lib/ai";
import { updateKyItemsAction, confirmKyActivityAction, deleteKyActivityAction } from "../actions";
import { Card, Input, Textarea, Button } from "@/components/ui";

export default async function KyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  const activity = await prisma.kyActivity.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { include: { customer: true } } },
  });
  if (!activity) notFound();

  const items = JSON.parse(activity.itemsJson) as KyItem[];
  const isDraft = activity.status === "DRAFT";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {activity.activityDate.toLocaleDateString("ja-JP")} KY(危険予知)
        </h1>
        <p className="text-sm text-slate-500">
          {activity.project.customer.name} / {activity.project.name}
        </p>
      </div>

      {!isDraft && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {activity.confirmedByName}さんが{activity.confirmedAt?.toLocaleString("ja-JP")}に承認済みです。
        </div>
      )}

      {error === "needName" && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          承認する現場責任者の氏名を入力してください。
        </p>
      )}
      {error === "incomplete" && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          危険ポイント・対策が空欄の行があります。すべて入力してから承認してください(AIが提案できなかった箇所は必ず人が確認・入力します)。
        </p>
      )}

      <Card>
        <p className="text-xs font-medium text-slate-500">作業内容</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{activity.workContent}</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">危険ポイント・対策</h2>
        {items.length === 0 && (
          <p className="mb-3 text-sm text-amber-700">
            作業内容から該当する候補が見つかりませんでした。危険ポイントと対策を入力してください。
          </p>
        )}
        {isDraft ? (
          <form action={updateKyItemsAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={activity.id} />
            {(items.length > 0 ? items : [{ risk: "", countermeasure: "" }]).map((item, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  危険ポイント
                  <Textarea name="risk" defaultValue={item.risk} rows={2} />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  対策
                  <Textarea name="countermeasure" defaultValue={item.countermeasure} rows={2} />
                </label>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                危険ポイント(追加)
                <Textarea name="risk" rows={2} placeholder="新しい項目を追加する場合はここに入力" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600">
                対策(追加)
                <Textarea name="countermeasure" rows={2} />
              </label>
            </div>
            <Button type="submit" variant="secondary" className="w-fit">
              内容を保存
            </Button>
          </form>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={i} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">危険: {item.risk}</p>
                <p className="text-slate-600">対策: {item.countermeasure}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isDraft && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">承認</h2>
          <form action={confirmKyActivityAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="id" value={activity.id} />
            <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
              現場責任者名
              <Input name="confirmedByName" placeholder="確認・承認する人の氏名" />
            </label>
            <Button type="submit">この内容で承認する</Button>
          </form>
        </Card>
      )}

      {isDraft && (
        <form action={deleteKyActivityAction}>
          <input type="hidden" name="id" value={activity.id} />
          <Button type="submit" variant="danger">
            このKYを削除する
          </Button>
        </form>
      )}
    </div>
  );
}
