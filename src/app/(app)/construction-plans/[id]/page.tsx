import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Button, Badge, FieldLabel } from "@/components/ui";
import { SECTION_STATUS_LABEL, SECTION_STATUS_COLOR } from "../statusLabel";
import {
  updatePlanMetaAction,
  markSubmissionReadyAction,
  deleteConstructionPlanAction,
} from "../actions";

export default async function ConstructionPlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const plan = await prisma.constructionPlan.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!plan) notFound();

  const confirmedCount = plan.sections.filter((s) => s.status === "CONFIRMED").length;
  const allConfirmed = confirmedCount === plan.sections.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{plan.project.name} 施工計画書</h1>
        <p className="text-sm text-slate-500">{plan.project.customer.name}</p>
      </div>

      {plan.isSubmissionReady ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          全章確認済みです。提出可能な状態としてマークされています。
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          確認済み {confirmedCount}/{plan.sections.length} 章。この施工計画書は下書きです。すべての章を「確認済み」にするまで提出可能にはなりません(元資料と生成文章の対応や、根拠のない断定がないかを人間が確認する仕組み — REQUIREMENTS.md)。
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {plan.sections.map((s) => (
            <li key={s.id}>
              <Link
                href={`/construction-plans/${plan.id}/sections/${s.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{s.title}</span>
                <Badge className={SECTION_STATUS_COLOR[s.status]}>{SECTION_STATUS_LABEL[s.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="max-w-lg">
        <h2 className="font-semibold text-slate-900">代理人・技術者情報</h2>
        <form action={updatePlanMetaAction} className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="id" value={plan.id} />
          <FieldLabel label="現場代理人">
            <Input name="agentName" defaultValue={plan.agentName ?? ""} />
          </FieldLabel>
          <FieldLabel label="主任技術者">
            <Input name="supervisorName" defaultValue={plan.supervisorName ?? ""} />
          </FieldLabel>
          <Button type="submit" variant="secondary" className="w-fit">
            更新する
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap gap-3">
        {allConfirmed && !plan.isSubmissionReady && (
          <form action={markSubmissionReadyAction}>
            <input type="hidden" name="id" value={plan.id} />
            <Button type="submit">提出可能にする</Button>
          </form>
        )}
        <form action={deleteConstructionPlanAction}>
          <input type="hidden" name="id" value={plan.id} />
          <Button type="submit" variant="danger">
            この施工計画書を削除する
          </Button>
        </form>
      </div>
    </div>
  );
}
