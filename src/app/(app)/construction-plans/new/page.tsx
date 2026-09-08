import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isPremium } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { NewPlanForm } from "./NewPlanForm";

export default async function NewConstructionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ voiceNote?: string }>;
}) {
  const { voiceNote } = await searchParams;
  const user = await requireUser();

  if (!isPremium(user.company)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">施工計画書を作成</h1>
        <UpgradePrompt featureName="AI施工計画書作成" />
      </div>
    );
  }

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
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">施工計画書を作成</h1>
      {voiceNote && (
        <Card className="max-w-lg border-indigo-200 bg-indigo-50/50">
          <p className="text-sm font-medium text-indigo-800">🎤「AIに話す」で話した内容(参考。自動入力はされません)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{voiceNote}</p>
        </Card>
      )}
      <Card className="max-w-lg">
        <NewPlanForm
          projects={projects.map((p) => ({
            id: p.id,
            label: `${p.customer.name} / ${p.name}`,
            siteAgentName: p.siteAgentName,
            chiefEngineerName: p.chiefEngineerName,
          }))}
        />
      </Card>
    </div>
  );
}
