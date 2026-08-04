import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "../totals";
import { PRICE_SOURCE_LABEL, QUOTE_STATUS_LABEL } from "../priceSourceLabel";
import {
  updateQuoteMetaAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  addQuoteItemAction,
  updateQuoteItemAction,
  deleteQuoteItemAction,
} from "../actions";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";
const primaryButtonClass =
  "rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500";
const secondaryButtonClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quote) notFound();

  const totals = computeQuoteTotals(quote.items, quote.taxRatePercent, quote.discountAmount);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{quote.title}</h1>
          <p className="text-sm text-slate-500">
            {quote.project.customer.name} / {quote.project.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/quotes/${quote.id}/print`} className={secondaryButtonClass}>
            印刷 / PDF保存
          </Link>
          <form action={duplicateQuoteAction}>
            <input type="hidden" name="id" value={quote.id} />
            <button className={secondaryButtonClass}>複製</button>
          </form>
        </div>
      </div>

      {/* 明細 */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">工事項目</th>
              <th className="px-2 py-2 font-medium">規格</th>
              <th className="px-2 py-2 font-medium">数量</th>
              <th className="px-2 py-2 font-medium">単位</th>
              <th className="px-2 py-2 font-medium">単価</th>
              <th className="px-2 py-2 font-medium">単価の根拠</th>
              <th className="px-2 py-2 font-medium">金額</th>
              <th className="px-2 py-2 font-medium">備考</th>
              <th className="px-2 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => {
              const formId = `quote-item-${item.id}`;
              return (
                <tr key={item.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="itemName"
                      defaultValue={item.itemName}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="spec"
                      defaultValue={item.spec ?? ""}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="quantity"
                      type="number"
                      step="any"
                      defaultValue={item.quantity}
                      className={`${inputClass} w-20`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="unit"
                      defaultValue={item.unit}
                      className={`${inputClass} w-16`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="unitPrice"
                      type="number"
                      defaultValue={item.unitPrice}
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      form={formId}
                      name="priceSource"
                      defaultValue={item.priceSource}
                      className={inputClass}
                    >
                      {Object.entries(PRICE_SOURCE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-900">
                    {(item.quantity * item.unitPrice).toLocaleString("ja-JP")}円
                  </td>
                  <td className="px-2 py-2">
                    <input
                      form={formId}
                      name="remarks"
                      defaultValue={item.remarks ?? ""}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <button form={formId} className="text-xs text-slate-600 underline">
                      保存
                    </button>{" "}
                    <button
                      form={`${formId}-delete`}
                      className="text-xs text-rose-600 underline"
                    >
                      削除
                    </button>
                    {/* テーブル構造(tr > td)を壊さないよう、行のformはtbody外に配置しinputはform属性で紐付ける */}
                    <form
                      id={formId}
                      action={updateQuoteItemAction}
                      className="hidden"
                    >
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                    </form>
                    <form
                      id={`${formId}-delete`}
                      action={deleteQuoteItemAction}
                      className="hidden"
                    >
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 行追加 */}
        <form action={addQuoteItemAction} className="flex flex-wrap items-end gap-2 border-t border-slate-200 p-3">
          <input type="hidden" name="quoteId" value={quote.id} />
          <Field label="工事項目" name="itemName" required />
          <Field label="規格" name="spec" />
          <Field label="数量" name="quantity" type="number" defaultValue="1" width="w-20" />
          <Field label="単位" name="unit" defaultValue="式" width="w-16" />
          <Field label="単価" name="unitPrice" type="number" defaultValue="0" width="w-24" />
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            単価の根拠
            <select name="priceSource" defaultValue="MANUAL" className={inputClass}>
              {Object.entries(PRICE_SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className={primaryButtonClass}>+ 行を追加</button>
        </form>
      </div>

      {/* 合計 */}
      <div className="ml-auto w-full max-w-xs rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 p-4 text-sm">
        <Row label="小計" value={totals.subtotal} />
        <Row label="値引き" value={-totals.discountAmount} />
        <Row label={`消費税(${quote.taxRatePercent}%)`} value={totals.tax} />
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
          <span>合計</span>
          <span>{totals.total.toLocaleString("ja-JP")}円</span>
        </div>
      </div>

      {/* 見積情報の編集 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 p-4">
        <h2 className="font-semibold text-slate-900">見積情報</h2>
        <form action={updateQuoteMetaAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={quote.id} />
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            見積名
            <input name="title" defaultValue={quote.title} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            ステータス
            <select name="status" defaultValue={quote.status} className={inputClass}>
              {Object.entries(QUOTE_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            消費税率(%)
            <input
              name="taxRatePercent"
              type="number"
              defaultValue={quote.taxRatePercent}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            値引き額
            <input
              name="discountAmount"
              type="number"
              defaultValue={quote.discountAmount}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            備考
            <textarea name="notes" defaultValue={quote.notes ?? ""} rows={2} className={inputClass} />
          </label>
          <button className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>更新する</button>
        </form>
      </div>

      <form action={deleteQuoteAction}>
        <input type="hidden" name="id" value={quote.id} />
        <button type="submit" className="text-sm text-rose-600 underline">
          この見積を削除する
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-0.5 text-slate-600">
      <span>{label}</span>
      <span>{value.toLocaleString("ja-JP")}円</span>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  width,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  width?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={`${inputClass} ${width ?? ""}`}
      />
    </label>
  );
}
