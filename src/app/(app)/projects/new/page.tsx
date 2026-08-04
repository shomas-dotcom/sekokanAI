import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "../ProjectForm";
import { createProjectAction } from "../actions";
import { Card } from "@/components/ui";

export default async function NewProjectPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">案件を追加</h1>
      {customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          先に
          <Link href="/customers/new" className="mx-1 font-medium text-orange-700 underline">
            顧客を登録
          </Link>
          してください。
        </p>
      ) : (
        <Card className="max-w-lg">
          <ProjectForm action={createProjectAction} customers={customers} submitLabel="登録する" />
        </Card>
      )}
    </div>
  );
}
