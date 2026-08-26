import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/PrintButton";
import { BILLING_TYPE_LABEL } from "../../statusLabel";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      items: { orderBy: { sortOrder: "asc" } },
      company: true,
    },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-zinc-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 18mm 15mm; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold">御請求書</h1>

      <div className="mt-6 flex justify-between">
        <div>
          <p className="text-base font-semibold">{invoice.project.customer.name} 御中</p>
          <p className="mt-4">工事名: {invoice.project.name}</p>
          <p className="mt-1 text-xs text-zinc-500">請求区分: {BILLING_TYPE_LABEL[invoice.billingType]}</p>
        </div>
        <div className="text-right">
          <p>請求番号: {invoice.invoiceNumber}</p>
          <p>発行日: {new Date(invoice.issueDate).toLocaleDateString("ja-JP")}</p>
          {invoice.dueDate && <p>支払期限: {new Date(invoice.dueDate).toLocaleDateString("ja-JP")}</p>}
          <p className="mt-4 font-semibold">{invoice.company.name}</p>
          {invoice.company.address && <p>{invoice.company.address}</p>}
          {invoice.company.phone && <p>TEL: {invoice.company.phone}</p>}
          {invoice.company.invoiceRegistrationNumber && (
            <p>登録番号: {invoice.company.invoiceRegistrationNumber}</p>
          )}
        </div>
      </div>

      <p className="mt-6 text-lg font-bold text-zinc-900">
        今回御請求金額(税込): {invoice.total.toLocaleString("ja-JP")}円
      </p>

      {invoice.items.length > 0 && (
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
            {invoice.items.map((item) => (
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
      )}

      <div className="ml-auto mt-4 w-64 text-sm">
        <div className="flex justify-between">
          <span>小計(税抜)</span>
          <span>{invoice.subtotal.toLocaleString("ja-JP")}円</span>
        </div>
        <div className="flex justify-between">
          <span>消費税({invoice.taxRatePercent}%)</span>
          <span>{invoice.taxAmount.toLocaleString("ja-JP")}円</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-400 pt-1 font-bold">
          <span>今回御請求金額(税込)</span>
          <span>{invoice.total.toLocaleString("ja-JP")}円</span>
        </div>
        {invoice.contractId && (
          <>
            <div className="mt-2 flex justify-between text-zinc-600">
              <span>前回までの請求額</span>
              <span>{invoice.previousBilledAmount.toLocaleString("ja-JP")}円</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>累計請求額</span>
              <span>{invoice.cumulativeBilledAmount.toLocaleString("ja-JP")}円</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>残額</span>
              <span>{invoice.remainingAmount.toLocaleString("ja-JP")}円</span>
            </div>
          </>
        )}
      </div>

      {invoice.company.bankName && (
        <div className="mt-6 rounded border border-zinc-300 p-3 text-sm">
          <p className="font-semibold">お振込先</p>
          <p>
            {invoice.company.bankName} {invoice.company.bankBranch}
            {invoice.company.bankAccountType ? ` ${invoice.company.bankAccountType}` : ""}{" "}
            {invoice.company.bankAccountNumber}
          </p>
          {invoice.company.bankAccountHolder && <p>{invoice.company.bankAccountHolder}</p>}
        </div>
      )}

      {invoice.notes && (
        <p className="mt-6 whitespace-pre-wrap text-sm text-zinc-700">備考: {invoice.notes}</p>
      )}
    </div>
  );
}
