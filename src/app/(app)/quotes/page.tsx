import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "./totals";
import { QUOTE_STATUS_LABEL } from "./priceSourceLabel";
import { Button, Badge } from "@/components/ui";

export default async function QuotesPage() {
  const user = await requireUser();
  const quotes = await prisma.quote.findMany({
    where: { companyId: user.companyId },
    include: { project: { include: { customer: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">見積</h1>
        <Link href="/quotes/new">
          <Button>+ 見積を作成</Button>
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ見積がありません。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quotes.map((q) => {
            const { total } = computeQuoteTotals(q.items, q.taxRatePercent, q.discountAmount);
            return (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{q.title}</p>
                  <Badge>{QUOTE_STATUS_LABEL[q.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {q.project.customer.name} / {q.project.name}
                </p>
                <p className="mt-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  {total.toLocaleString("ja-JP")}円
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
