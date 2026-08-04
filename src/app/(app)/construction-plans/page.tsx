import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Badge } from "@/components/ui";

export default async function ConstructionPlansPage() {
  const user = await requireUser();
  const plans = await prisma.constructionPlan.findMany({
    where: { companyId: user.companyId },
    include: { project: { include: { customer: true } }, sections: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">施工計画書</h1>
        <Link href="/construction-plans/new">
          <Button>+ 施工計画書を作成</Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ施工計画書がありません。
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map((p) => {
            const confirmed = p.sections.filter((s) => s.status === "CONFIRMED").length;
            return (
              <Link
                key={p.id}
                href={`/construction-plans/${p.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">{p.project.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{p.project.customer.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.isSubmissionReady && <Badge className="bg-emerald-50 text-emerald-700">提出可能</Badge>}
                  <Badge>
                    確認済み {confirmed}/{p.sections.length}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
