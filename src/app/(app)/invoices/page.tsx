import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_COLOR } from "./statusLabel";
import { Button, Badge } from "@/components/ui";

export default async function InvoicesPage() {
  const user = await requireUser();
  const invoices = await prisma.invoice.findMany({
    where: { companyId: user.companyId },
    include: { project: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">請求書</h1>
        <Link href="/invoices/new">
          <Button>+ 請求書を作成</Button>
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ請求書がありません。案件から請求書を作成してください。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{inv.invoiceNumber}</p>
                <Badge className={INVOICE_STATUS_COLOR[inv.status]}>
                  {INVOICE_STATUS_LABEL[inv.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {inv.project.customer.name} / {inv.project.name}
              </p>
              {inv.dueDate && (
                <p className="mt-1 text-xs text-slate-400">
                  支払期限: {new Date(inv.dueDate).toLocaleDateString("ja-JP")}
                </p>
              )}
              <p className="mt-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                {inv.total.toLocaleString("ja-JP")}円
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
