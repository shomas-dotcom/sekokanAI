"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyVoiceIntent } from "@/lib/ai";
import { createDailyReportAction } from "../daily-reports/actions";
import { createKyActivityAction } from "../ky/actions";

export type VoiceEntryFormState = { error?: string } | undefined;

/**
 * ダッシュボードの「話して記録する」窓口。ベテラン・年配の方でも迷わないよう、
 * 「日報」か「KY」かを選ばせず、話した内容からAIが自動で振り分ける
 * (判定方法は @/lib/ai の classifyVoiceIntent 参照)。
 * 実際の作成処理は既存の日報作成・KY作成の仕組みをそのまま呼び出す
 * (振り分け先を増やしても、保存ロジックを二重に持たないようにするため)。
 */
export async function submitVoiceEntryAction(
  _prevState: VoiceEntryFormState,
  formData: FormData
): Promise<VoiceEntryFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const transcript = String(formData.get("transcript") ?? "").trim();

  if (!projectId) return { error: "現場を選択してください。" };
  if (!transcript) return { error: "マイクで話すか、内容を入力してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "現場が見つかりません。" };

  const intent = await classifyVoiceIntent(transcript);
  const today = new Date().toISOString().slice(0, 10);

  if (intent === "KY") {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("activityDate", today);
    fd.set("workContent", transcript);
    return createKyActivityAction(undefined, fd);
  }

  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("reportDate", today);
  fd.set("rawVoiceInput", transcript);
  return createDailyReportAction(undefined, fd);
}
