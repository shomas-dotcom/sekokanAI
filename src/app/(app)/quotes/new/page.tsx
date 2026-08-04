import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewQuoteForm } from "./NewQuoteForm";

export default async function NewQuotePage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  if (projects.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
        先に
        <Link href="/projects/new" className="mx-1 underline">
          案件を登録
        </Link>
        してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-900">見積を作成</h1>
      <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <NewQuoteForm
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.customer.name} / ${p.name}`,
          }))}
        />
      </div>
    </div>
  );
}
