import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "./totals";
import { QUOTE_STATUS_LABEL } from "./priceSourceLabel";

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
        <h1 className="text-xl font-bold text-zinc-900">見積</h1>
        <Link
          href="/quotes/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + 見積を作成
        </Link>
      </div>

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
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
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-zinc-900">{q.title}</p>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {QUOTE_STATUS_LABEL[q.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {q.project.customer.name} / {q.project.name}
                </p>
                <p className="mt-2 text-lg font-bold text-zinc-900">
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
