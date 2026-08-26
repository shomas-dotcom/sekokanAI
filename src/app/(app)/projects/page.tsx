import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL } from "./statusLabel";
import { Button, Badge } from "@/components/ui";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">案件管理</h1>
        <Link href="/projects/new">
          <Button>+ 案件を追加</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ案件が登録されていません。先に顧客を登録してください。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <Badge>{STATUS_LABEL[p.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {p.projectCode ? `${p.projectCode} / ` : ""}
                {p.customer.name}
              </p>
              {p.siteAddress && <p className="mt-1 text-xs text-slate-400">{p.siteAddress}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
