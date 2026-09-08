import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewInvoiceForm } from "./NewInvoiceForm";
import { Card } from "@/components/ui";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ voiceNote?: string }>;
}) {
  const { voiceNote } = await searchParams;
  const user = await requireUser();

  const [projects, contracts] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: user.companyId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findMany({
      where: { companyId: user.companyId, status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

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
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">請求書を作成</h1>
      {voiceNote && (
        <Card className="max-w-lg border-indigo-200 bg-indigo-50/50">
          <p className="text-sm font-medium text-indigo-800">🎤「AIに話す」で話した内容(参考。自動入力はされません)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{voiceNote}</p>
        </Card>
      )}
      <Card className="max-w-lg">
        <NewInvoiceForm
          projects={projects.map((p) => ({ id: p.id, label: `${p.customer.name} / ${p.name}` }))}
          contracts={contracts.map((c) => ({
            id: c.id,
            projectId: c.projectId,
            label: `${c.contractNumber}(${c.contractAmountIncludingTax.toLocaleString("ja-JP")}円)`,
          }))}
        />
      </Card>
    </div>
  );
}
