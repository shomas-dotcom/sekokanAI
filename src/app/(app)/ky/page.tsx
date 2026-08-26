import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Badge } from "@/components/ui";

export default async function KyListPage() {
  const user = await requireUser();
  const activities = await prisma.kyActivity.findMany({
    where: { companyId: user.companyId },
    include: { project: { include: { customer: true } } },
    orderBy: { activityDate: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">KY(危険予知)</h1>
        <Link href="/ky/new">
          <Button>+ KYを作成</Button>
        </Link>
      </div>

      {activities.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだKY活動が記録されていません。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activities.map((a) => (
            <Link
              key={a.id}
              href={`/ky/${a.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">
                  {a.activityDate.toLocaleDateString("ja-JP")}
                </p>
                <Badge
                  className={
                    a.status === "CONFIRMED"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }
                >
                  {a.status === "CONFIRMED" ? "承認済み" : "未承認"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {a.project.customer.name} / {a.project.name}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.workContent}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
