import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_LABEL } from "./statusLabel";

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
        <h1 className="text-xl font-bold text-zinc-900">案件管理</h1>
        <Link
          href="/projects/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + 案件を追加
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          まだ案件が登録されていません。先に顧客を登録してください。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-400"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-zinc-900">{p.name}</p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{p.customer.name}</p>
              {p.siteAddress && <p className="mt-1 text-xs text-zinc-400">{p.siteAddress}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
