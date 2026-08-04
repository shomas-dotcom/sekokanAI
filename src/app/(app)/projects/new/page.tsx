import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "../ProjectForm";
import { createProjectAction } from "../actions";

export default async function NewProjectPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-900">案件を追加</h1>
      {customers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          先に
          <Link href="/customers/new" className="mx-1 underline">
            顧客を登録
          </Link>
          してください。
        </p>
      ) : (
        <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
          <ProjectForm action={createProjectAction} customers={customers} submitLabel="登録する" />
        </div>
      )}
    </div>
  );
}
