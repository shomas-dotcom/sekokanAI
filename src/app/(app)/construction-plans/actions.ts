"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isPremium } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { CONSTRUCTION_PLAN_SECTIONS, draftConstructionPlanSection } from "@/lib/ai";
import { linesToJson } from "./planUtils";

export type PlanFormState = { error?: string } | undefined;

export async function createConstructionPlanAction(
  _prevState: PlanFormState,
  formData: FormData
): Promise<PlanFormState> {
  const user = await requireUser();
  // AI施工計画書作成はプレミアム機能。UI側でも案内するが、Server Functionは直接POSTで
  // 到達可能なためここでも必ず検証する(SECURITY.md)。
  if (!isPremium(user.company)) return { error: "この機能はAIプレミアムのご契約が必要です。" };

  const projectId = String(formData.get("projectId") ?? "");
  const agentName = String(formData.get("agentName") ?? "").trim() || null;
  const supervisorName = String(formData.get("supervisorName") ?? "").trim() || null;

  if (!projectId) return { error: "案件を選択してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  const plan = await prisma.constructionPlan.create({
    data: {
      companyId: user.companyId,
      projectId,
      agentName,
      supervisorName,
      sections: {
        create: CONSTRUCTION_PLAN_SECTIONS.map((s, index) => ({
          sectionKey: s.key,
          title: s.title,
          sortOrder: index,
          status: "NEEDS_INPUT",
          missingInfoJson: JSON.stringify(["未入力です"]),
        })),
      },
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "constructionPlan.create",
    targetType: "ConstructionPlan",
    targetId: plan.id,
  });

  revalidatePath("/construction-plans");
  redirect(`/construction-plans/${plan.id}`);
}

export async function updatePlanMetaAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const plan = await prisma.constructionPlan.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!plan) redirect("/construction-plans");

  await prisma.constructionPlan.update({
    where: { id },
    data: {
      agentName: String(formData.get("agentName") ?? "").trim() || null,
      supervisorName: String(formData.get("supervisorName") ?? "").trim() || null,
    },
  });

  revalidatePath(`/construction-plans/${id}`);
  redirect(`/construction-plans/${id}`);
}

export async function markSubmissionReadyAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const plan = await prisma.constructionPlan.findFirst({
    where: { id, companyId: user.companyId },
    include: { sections: true },
  });
  if (!plan) redirect("/construction-plans");

  const allConfirmed = plan.sections.every((s) => s.status === "CONFIRMED");
  if (allConfirmed) {
    await prisma.constructionPlan.update({
      where: { id },
      data: { isSubmissionReady: true },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "constructionPlan.markSubmissionReady",
      targetType: "ConstructionPlan",
      targetId: id,
    });
  }

  revalidatePath(`/construction-plans/${id}`);
  redirect(`/construction-plans/${id}`);
}

export async function deleteConstructionPlanAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.constructionPlan.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "constructionPlan.delete",
    targetType: "ConstructionPlan",
    targetId: id,
  });

  revalidatePath("/construction-plans");
  redirect("/construction-plans");
}

// --- セクション単位の操作 ---

async function findOwnedSection(companyId: string, sectionId: string) {
  return prisma.constructionPlanSection.findFirst({
    where: { id: sectionId, plan: { companyId } },
    include: { plan: true },
  });
}

export async function updateSectionAction(formData: FormData) {
  const user = await requireUser();
  const sectionId = String(formData.get("sectionId") ?? "");
  const section = await findOwnedSection(user.companyId, sectionId);
  if (!section) redirect("/construction-plans");

  const content = String(formData.get("content") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "NEEDS_INPUT");
  const missingInfoText = String(formData.get("missingInfoText") ?? "");
  const assumedItemsText = String(formData.get("assumedItemsText") ?? "");
  const sourceRefsText = String(formData.get("sourceRefsText") ?? "");

  await prisma.constructionPlanSection.update({
    where: { id: sectionId },
    data: {
      content,
      status: status as never,
      missingInfoJson: linesToJson(missingInfoText),
      assumedItemsJson: linesToJson(assumedItemsText),
      sourceRefsJson: linesToJson(sourceRefsText),
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "constructionPlanSection.update",
    targetType: "ConstructionPlanSection",
    targetId: sectionId,
  });

  revalidatePath(`/construction-plans/${section!.planId}`);
  redirect(`/construction-plans/${section!.planId}/sections/${sectionId}`);
}

export async function aiDraftSectionAction(formData: FormData) {
  const user = await requireUser();
  const sectionId = String(formData.get("sectionId") ?? "");
  const memo = String(formData.get("memo") ?? "");
  const section = await findOwnedSection(user.companyId, sectionId);
  if (!section) redirect("/construction-plans");

  const draft = await draftConstructionPlanSection(section!.title, memo);

  if (draft.content) {
    await prisma.constructionPlanSection.update({
      where: { id: sectionId },
      data: {
        content: draft.content,
        status: "NEEDS_CONFIRMATION",
        assumedItemsJson: JSON.stringify(draft.assumedItems),
        missingInfoJson: JSON.stringify([]),
      },
    });
  }

  revalidatePath(`/construction-plans/${section!.planId}`);
  redirect(`/construction-plans/${section!.planId}/sections/${sectionId}`);
}
