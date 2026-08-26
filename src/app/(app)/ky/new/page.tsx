import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewKyForm } from "./NewKyForm";
import { Card } from "@/components/ui";

export default async function NewKyActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
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
          現場を登録
        </Link>
        してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">KY(危険予知)を作成</h1>
      <Card className="max-w-xl">
        <NewKyForm
          projects={projects.map((p) => ({ id: p.id, label: `${p.customer.name} / ${p.name}` }))}
          defaultProjectId={projects.some((p) => p.id === projectId) ? projectId : undefined}
        />
      </Card>
    </div>
  );
}
