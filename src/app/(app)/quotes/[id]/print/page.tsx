import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "../../totals";
import { PrintButton } from "./PrintButton";

export default async function QuotePrintPage({
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
      company: true,
    },
  });
  if (!quote) notFound();

  const totals = computeQuoteTotals(quote.items, quote.taxRatePercent, quote.discountAmount);
  const today = new Date().toLocaleDateString("ja-JP");

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold text-zinc-900">御見積書</h1>

      <div className="mt-6 flex justify-between text-sm text-zinc-800">
        <div>
          <p className="text-base font-semibold">{quote.project.customer.name} 御中</p>
          <p className="mt-4">工事名: {quote.project.name}</p>
          {quote.project.siteAddress && <p>現場: {quote.project.siteAddress}</p>}
        </div>
        <div className="text-right">
          <p>発行日: {today}</p>
          {quote.expirationDate && (
            <p>見積有効期限: {new Date(quote.expirationDate).toLocaleDateString("ja-JP")}</p>
          )}
          <p className="mt-4 font-semibold">{quote.company.name}</p>
          {quote.company.address && <p>{quote.company.address}</p>}
          {quote.company.phone && <p>TEL: {quote.company.phone}</p>}
          {quote.company.representativeName && <p>代表: {quote.company.representativeName}</p>}
        </div>
      </div>

      <p className="mt-6 text-lg font-bold text-zinc-900">
        合計金額(税込): {totals.total.toLocaleString("ja-JP")}円
      </p>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-400 text-left">
            <th className="py-1">工事項目</th>
            <th className="py-1">規格</th>
            <th className="py-1 text-right">数量</th>
            <th className="py-1">単位</th>
            <th className="py-1 text-right">単価</th>
            <th className="py-1 text-right">金額</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-1">{item.itemName}</td>
              <td className="py-1">{item.spec}</td>
              <td className="py-1 text-right">{item.quantity}</td>
              <td className="py-1">{item.unit}</td>
              <td className="py-1 text-right">{item.unitPrice.toLocaleString("ja-JP")}</td>
              <td className="py-1 text-right">
                {(item.quantity * item.unitPrice).toLocaleString("ja-JP")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto mt-4 w-56 text-sm">
        <div className="flex justify-between">
          <span>小計</span>
          <span>{totals.subtotal.toLocaleString("ja-JP")}円</span>
        </div>
        <div className="flex justify-between">
          <span>値引き</span>
          <span>-{totals.discountAmount.toLocaleString("ja-JP")}円</span>
        </div>
        <div className="flex justify-between">
          <span>消費税({quote.taxRatePercent}%)</span>
          <span>{totals.tax.toLocaleString("ja-JP")}円</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-400 pt-1 font-bold">
          <span>合計</span>
          <span>{totals.total.toLocaleString("ja-JP")}円</span>
        </div>
      </div>

      {quote.notes && (
        <p className="mt-6 whitespace-pre-wrap text-sm text-zinc-700">備考: {quote.notes}</p>
      )}
    </div>
  );
}
