import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_COLOR } from "./statusLabel";
import { Button, Badge } from "@/components/ui";

export default async function ContractsPage() {
  const user = await requireUser();
  const contracts = await prisma.contract.findMany({
    where: { companyId: user.companyId },
    include: { project: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">工事請負契約書</h1>
        <Link href="/contracts/new">
          <Button>+ 契約書を作成</Button>
        </Link>
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ契約書がありません。案件から契約書を作成してください。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/contracts/${c.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{c.contractNumber}</p>
                <Badge className={CONTRACT_STATUS_COLOR[c.status]}>
                  {CONTRACT_STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {c.project.customer.name} / {c.project.name}
              </p>
              <p className="mt-2 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                {c.contractAmountIncludingTax.toLocaleString("ja-JP")}円
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
