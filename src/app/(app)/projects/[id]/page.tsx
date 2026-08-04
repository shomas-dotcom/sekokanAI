import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "../ProjectForm";
import { updateProjectAction, deleteProjectAction } from "../actions";

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
      <h1 className="text-xl font-bold text-zinc-900">{project.name}</h1>
      <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <ProjectForm
          action={updateProjectAction}
          project={project}
          customers={customers}
          submitLabel="更新する"
        />
      </div>
      <form action={deleteProjectAction} className="max-w-lg">
        <input type="hidden" name="id" value={project.id} />
        <button type="submit" className="text-sm text-red-600 underline">
          この案件を削除する
        </button>
      </form>
    </div>
  );
}
