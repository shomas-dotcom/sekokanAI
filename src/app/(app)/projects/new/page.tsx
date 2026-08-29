import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectPageClient } from "./NewProjectPageClient";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ prefillTranscript?: string }>;
}) {
  const { prefillTranscript } = await searchParams;
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
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            先に
            <Link href="/customers/new" className="mx-1 font-medium text-orange-700 underline">
              顧客を登録
            </Link>
            してください。
          </p>
          {prefillTranscript && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              音声入力で話した内容: 「{prefillTranscript}」(顧客登録後、もう一度この内容を話すか貼り付けてください)
            </p>
          )}
        </div>
      ) : (
        <NewProjectPageClient customers={customers} initialTranscript={prefillTranscript} />
      )}
    </div>
  );
}
