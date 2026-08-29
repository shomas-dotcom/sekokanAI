import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { VoiceEntryForm } from "./VoiceEntryForm";

export default async function VoiceEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const user = await requireUser();

  // 顧客登録・従業員登録・案件依頼は現場が1件も無くても使えるため、
  // 現場が無い場合でも(現場を選ぶ欄が空の状態で)このまま使えるようにする。
  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    include: { customer: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">話して記録する</h1>
      <p className="text-sm text-slate-500">
        日報・危険予知(KY)・新しい取引先・従業員・見積依頼、どれでも選ばずに話すだけで大丈夫です。内容を見て自動で振り分けます。
      </p>
      <Card className="max-w-xl">
        <VoiceEntryForm
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            customerName: p.customer.name,
          }))}
          defaultProjectId={projects.some((p) => p.id === projectId) ? projectId : undefined}
        />
      </Card>
    </div>
  );
}
