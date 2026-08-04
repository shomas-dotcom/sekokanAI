import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewDailyReportForm } from "./NewDailyReportForm";
import { Card } from "@/components/ui";

export default async function NewDailyReportPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  if (projects.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        先に
        <Link href="/projects/new" className="mx-1 font-medium text-orange-700 underline">
          案件を登録
        </Link>
        してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">日報を作成</h1>
      <Card className="max-w-xl">
        <NewDailyReportForm
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.customer.name} / ${p.name}`,
          }))}
        />
      </Card>
    </div>
  );
}
