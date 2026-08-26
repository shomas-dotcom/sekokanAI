import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_COLOR, BILLING_TYPE_LABEL } from "../statusLabel";
import {
  updateInvoiceMetaAction,
  addInvoiceItemAction,
  updateInvoiceItemAction,
  deleteInvoiceItemAction,
  issueInvoiceAction,
  cancelInvoiceAction,
  deleteInvoiceAction,
} from "../actions";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 shadow-sm transition focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";
const primaryButtonClass =
  "rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-50";
const secondaryButtonClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50";

function toDateInputValue(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      contract: true,
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!invoice) notFound();

  const isDraft = invoice.status === "DRAFT";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-500">
            {invoice.project.customer.name} / {invoice.project.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLOR[invoice.status]}`}
          >
            {INVOICE_STATUS_LABEL[invoice.status]}
          </span>
          <Link href={`/invoices/${invoice.id}/print`} className={secondaryButtonClass}>
            印刷 / PDF保存
          </Link>
        </div>
      </div>

      {error === "exceeds" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          この操作を行うと累計請求額が契約金額(税込)を超えるため、保存できませんでした。数量・単価を見直してください。
        </div>
      )}
      {error === "invalid" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          数量・単価は0以上の値を入力してください。
        </div>
      )}

      {!isDraft && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          この請求書は{INVOICE_STATUS_LABEL[invoice.status]}です。内容は発行時点のスナップショットとして保存されており、以後変更されません。
        </div>
      )}

      {/* 明細 */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">工事項目</th>
              <th className="px-2 py-2 font-medium">規格</th>
              <th className="px-2 py-2 font-medium">数量</th>
              <th className="px-2 py-2 font-medium">単位</th>
              <th className="px-2 py-2 font-medium">単価</th>
              <th className="px-2 py-2 font-medium">金額</th>
              <th className="px-2 py-2 font-medium">備考</th>
              <th className="px-2 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => {
              const formId = `invoice-item-${item.id}`;
              return (
                <tr key={item.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-2 py-2">
                    <input form={formId} name="itemName" defaultValue={item.itemName} disabled={!isDraft} className={inputClass} />
                  </td>
                  <td className="px-2 py-2">
                    <input form={formId} name="spec" defaultValue={item.spec ?? ""} disabled={!isDraft} className={inputClass} />
                  </td>
                  <td className="px-2 py-2">
                    <input form={formId} name="quantity" type="number" step="any" defaultValue={item.quantity} disabled={!isDraft} className={`${inputClass} w-20`} />
                  </td>
                  <td className="px-2 py-2">
                    <input form={formId} name="unit" defaultValue={item.unit} disabled={!isDraft} className={`${inputClass} w-16`} />
                  </td>
                  <td className="px-2 py-2">
                    <input form={formId} name="unitPrice" type="number" defaultValue={item.unitPrice} disabled={!isDraft} className={`${inputClass} w-24`} />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-900">
                    {(item.quantity * item.unitPrice).toLocaleString("ja-JP")}円
                  </td>
                  <td className="px-2 py-2">
                    <input form={formId} name="remarks" defaultValue={item.remarks ?? ""} disabled={!isDraft} className={inputClass} />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {isDraft && (
                      <>
                        <button form={formId} className="text-xs text-slate-600 underline">
                          保存
                        </button>{" "}
                        <button form={`${formId}-delete`} className="text-xs text-rose-600 underline">
                          削除
                        </button>
                      </>
                    )}
                    <form id={formId} action={updateInvoiceItemAction} className="hidden">
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                    </form>
                    <form id={`${formId}-delete`} action={deleteInvoiceItemAction} className="hidden">
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {isDraft && (
          <form action={addInvoiceItemAction} className="flex flex-wrap items-end gap-2 border-t border-slate-200 p-3">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <Field label="工事項目" name="itemName" required />
            <Field label="規格" name="spec" />
            <Field label="数量" name="quantity" type="number" defaultValue="1" width="w-20" />
            <Field label="単位" name="unit" defaultValue="式" width="w-16" />
            <Field label="単価" name="unitPrice" type="number" defaultValue="0" width="w-24" />
            <button className={primaryButtonClass}>+ 行を追加</button>
          </form>
        )}
      </div>

      {/* 請求進行状況 */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/50">
          <h2 className="font-semibold text-slate-900">今回請求額</h2>
          <Row label="小計" value={invoice.subtotal} />
          <Row label={`消費税(${invoice.taxRatePercent}%)`} value={invoice.taxAmount} />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>今回請求額(税込)</span>
            <span>{invoice.total.toLocaleString("ja-JP")}円</span>
          </div>
        </div>
        {invoice.contract && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-200/50">
            <h2 className="font-semibold text-slate-900">
              契約({invoice.contract.contractNumber})に対する進行状況
            </h2>
            <Row label="契約金額(税込)" value={invoice.contract.contractAmountIncludingTax} />
            <Row label="前回までの請求額" value={invoice.previousBilledAmount} />
            <Row label="累計請求額" value={invoice.cumulativeBilledAmount} />
            <div
              className={`mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold ${
                invoice.remainingAmount < 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              <span>残額</span>
              <span>{invoice.remainingAmount.toLocaleString("ja-JP")}円</span>
            </div>
          </div>
        )}
      </div>

      {/* 請求書情報の編集 */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 p-4">
        <h2 className="font-semibold text-slate-900">請求書情報</h2>
        <form action={updateInvoiceMetaAction} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={invoice.id} />
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            請求区分
            <select name="billingType" defaultValue={invoice.billingType} disabled={!isDraft} className={inputClass}>
              {Object.entries(BILLING_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            消費税率(%)
            <input type="number" name="taxRatePercent" defaultValue={invoice.taxRatePercent} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            発行日
            <input type="date" name="issueDate" defaultValue={toDateInputValue(invoice.issueDate)} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            支払期限
            <input type="date" name="dueDate" defaultValue={toDateInputValue(invoice.dueDate)} disabled={!isDraft} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
            備考
            <textarea name="notes" defaultValue={invoice.notes ?? ""} rows={2} disabled={!isDraft} className={inputClass} />
          </label>
          {isDraft && <button className={`${primaryButtonClass} sm:col-span-2 sm:w-fit`}>更新する</button>}
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        {isDraft && (
          <form action={issueInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button className={primaryButtonClass} disabled={invoice.items.length === 0}>
              この内容で発行する
            </button>
          </form>
        )}
        {!isDraft && invoice.status !== "CANCELLED" && (
          <form action={cancelInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button className={secondaryButtonClass}>この請求書を取消にする</button>
          </form>
        )}
        {isDraft && (
          <form action={deleteInvoiceAction}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit" className="text-sm text-rose-600 underline">
              この請求書を削除する
            </button>
          </form>
        )}
      </div>
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
      <input name={name} type={type} required={required} defaultValue={defaultValue} className={`${inputClass} ${width ?? ""}`} />
    </label>
  );
}
