import Link from "next/link";
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

  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    include: { customer: true },
    orderBy: { updatedAt: "desc" },
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
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">話して記録する</h1>
      <p className="text-sm text-slate-500">
        日報でも危険予知(KY)でも、選ばずに話すだけで大丈夫です。内容を見て自動で振り分けます。
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
