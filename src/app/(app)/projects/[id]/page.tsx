import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "../ProjectForm";
import { updateProjectAction, deleteProjectAction } from "../actions";
import { Card, Button } from "@/components/ui";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [project, customers] = await Promise.all([
    prisma.project.findFirst({ where: { id, companyId: user.companyId } }),
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
      <Card className="max-w-lg">
        <ProjectForm
          action={updateProjectAction}
          project={project}
          customers={customers}
          submitLabel="更新する"
        />
      </Card>
      <form action={deleteProjectAction} className="max-w-lg">
        <input type="hidden" name="id" value={project.id} />
        <Button type="submit" variant="danger">
          この案件を削除する
        </Button>
      </form>
    </div>
  );
}
