import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Textarea, Select, Button, FieldLabel, Badge } from "@/components/ui";
import { SECTION_STATUS_LABEL, SECTION_STATUS_COLOR } from "../../../statusLabel";
import { updateSectionAction, aiDraftSectionAction } from "../../../actions";
import { jsonToLines } from "../../../planUtils";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const { id, sectionId } = await params;
  const user = await requireUser();

  const section = await prisma.constructionPlanSection.findFirst({
    where: { id: sectionId, planId: id, plan: { companyId: user.companyId } },
  });
  if (!section) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/construction-plans/${id}`} className="text-sm font-medium text-orange-700 underline">
          ← 施工計画書に戻る
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{section.title}</h1>
          <Badge className={SECTION_STATUS_COLOR[section.status]}>{SECTION_STATUS_LABEL[section.status]}</Badge>
        </div>
      </div>

      <Card className="bg-indigo-50/50 border-indigo-100">
        <h2 className="text-sm font-semibold text-indigo-900">AIで下書きを整形</h2>
        <p className="mt-1 text-xs text-indigo-700">
          箇条書きでメモを入力すると、AIが文章として整形します(内容を新たに作り出すことはしません。整形後は必ず内容を確認してください)。
        </p>
        <form action={aiDraftSectionAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="sectionId" value={section.id} />
          <Textarea name="memo" rows={3} placeholder={"例:\n仮設ヤードは現場北側に設置\n工事車両は南側道路から出入り"} />
          <Button type="submit" variant="ai" className="w-fit">
            AIで整形する
          </Button>
        </form>
      </Card>

      <Card className="max-w-2xl">
        <form action={updateSectionAction} className="flex flex-col gap-4">
          <input type="hidden" name="sectionId" value={section.id} />

          <FieldLabel label="本文">
            <Textarea name="content" rows={8} defaultValue={section.content ?? ""} />
          </FieldLabel>

          <FieldLabel label="ステータス">
            <Select name="status" defaultValue={section.status}>
              {Object.entries(SECTION_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldLabel>

          <FieldLabel label="不足情報(1行に1項目)">
            <Textarea
              name="missingInfoText"
              rows={2}
              defaultValue={jsonToLines(section.missingInfoJson)}
              placeholder="例: 交通規制図が未取得"
            />
          </FieldLabel>

          <FieldLabel label="推測で埋めた箇所(1行に1項目)">
            <Textarea
              name="assumedItemsText"
              rows={2}
              defaultValue={jsonToLines(section.assumedItemsJson)}
              placeholder="例: 工程表の起算日は契約日を仮定"
            />
          </FieldLabel>

          <FieldLabel label="元資料との対応(1行に1項目)">
            <Textarea
              name="sourceRefsText"
              rows={2}
              defaultValue={jsonToLines(section.sourceRefsJson)}
              placeholder="例: 仕様書 p.12 参照"
            />
          </FieldLabel>

          <Button type="submit">保存する</Button>
        </form>
      </Card>
    </div>
  );
}
