import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge, Button } from "@/components/ui";
import { ActiveToggleButton } from "../ActiveToggleButton";
import { addQuoteTemplateVersionAction } from "../actions";

export default async function QuoteTemplateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const admin = await requireAdmin();
  const template = await prisma.quoteTemplate.findFirst({
    where: { id, companyId: admin.companyId },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!template) notFound();

  const latest = template.versions[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{template.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link href="/settings/quote-templates" className="hover:underline">
              ← 雛形の一覧へ戻る
            </Link>
          </p>
        </div>
        <ActiveToggleButton templateId={template.id} isActive={template.isActive} />
      </div>

      {error === "storage" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ 保存容量の上限を超えるため、ファイルを差し替えられませんでした。不要な写真・ファイルを削除するか、運営までご相談ください。
        </p>
      )}

      {latest && (
        <Card>
          <h2 className="font-semibold text-slate-900">現在のバージョン: v{latest.versionNumber}</h2>
          <p className="mt-1 text-sm text-slate-500">
            ファイル名: {latest.fileName}
            {latest.itemMaxRows > 0 ? (
              <span className="ml-2 text-emerald-700">位置合わせ済み(見積で使えます)</span>
            ) : (
              <span className="ml-2 text-amber-700">位置合わせ未完了(このままでは使えません)</span>
            )}
          </p>
          <div className="mt-3">
            <Link
              href={`/settings/quote-templates/${template.id}/versions/${latest.id}/mapping`}
              className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-600/25 hover:from-amber-400 hover:to-orange-500"
            >
              位置合わせ画面を開く
            </Link>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-slate-900">ファイルを差し替える</h2>
        <p className="mt-1 text-sm text-slate-500">
          レイアウトを変更したExcelファイルを登録すると新しいバージョンになり、位置合わせをやり直します。
          すでに発行した見積は、差し替え前のバージョンのまま変わりません。
        </p>
        <form action={addQuoteTemplateVersionAction} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="templateId" value={template.id} />
          <input
            type="file"
            name="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <Button type="submit" variant="secondary" className="self-start">
            新しいバージョンとして登録
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">バージョン履歴</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {template.versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>
                <Badge>v{v.versionNumber}</Badge> {v.fileName}
              </span>
              <Link href={`/settings/quote-templates/${template.id}/versions/${v.id}/mapping`} className="text-slate-600 hover:underline">
                位置合わせを見る
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
