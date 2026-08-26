"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { draftKyItems, type KyItem } from "@/lib/ai";

export type KyFormState = { error?: string } | undefined;

export async function createKyActivityAction(
  _prevState: KyFormState,
  formData: FormData
): Promise<KyFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const activityDateStr = String(formData.get("activityDate") ?? "");
  const workContent = String(formData.get("workContent") ?? "").trim();

  if (!projectId) return { error: "現場を選択してください。" };
  if (!activityDateStr) return { error: "日付を入力してください。" };
  if (!workContent) return { error: "作業内容を入力してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "現場が見つかりません。" };

  const items = await draftKyItems(workContent);

  const activity = await prisma.kyActivity.create({
    data: {
      companyId: user.companyId,
      projectId,
      activityDate: new Date(activityDateStr),
      workContent,
      itemsJson: JSON.stringify(items),
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "kyActivity.create",
    targetType: "KyActivity",
    targetId: activity.id,
  });

  revalidatePath("/ky");
  redirect(`/ky/${activity.id}`);
}

export async function updateKyItemsAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const activity = await prisma.kyActivity.findFirst({ where: { id, companyId: user.companyId } });
  if (!activity) redirect("/ky");
  if (activity!.status !== "DRAFT") redirect(`/ky/${id}`);

  const risks = formData.getAll("risk").map(String);
  const countermeasures = formData.getAll("countermeasure").map(String);
  const items: KyItem[] = risks
    .map((risk, i) => ({ risk: risk.trim(), countermeasure: (countermeasures[i] ?? "").trim() }))
    .filter((item) => item.risk || item.countermeasure);

  await prisma.kyActivity.update({
    where: { id },
    data: { itemsJson: JSON.stringify(items) },
  });

  revalidatePath(`/ky/${id}`);
  redirect(`/ky/${id}`);
}

export async function confirmKyActivityAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const confirmedByName = String(formData.get("confirmedByName") ?? "").trim();

  const activity = await prisma.kyActivity.findFirst({ where: { id, companyId: user.companyId } });
  if (!activity) redirect("/ky");
  if (!confirmedByName) redirect(`/ky/${id}?error=needName`);

  const items = JSON.parse(activity!.itemsJson) as KyItem[];
  const hasEmptyItem = items.length === 0 || items.some((i) => !i.risk.trim() || !i.countermeasure.trim());
  if (hasEmptyItem) redirect(`/ky/${id}?error=incomplete`);

  await prisma.kyActivity.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedByName, confirmedAt: new Date() },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "kyActivity.confirm",
    targetType: "KyActivity",
    targetId: id,
  });

  revalidatePath(`/ky/${id}`);
  redirect(`/ky/${id}`);
}

export async function deleteKyActivityAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.kyActivity.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "kyActivity.delete",
    targetType: "KyActivity",
    targetId: id,
  });

  revalidatePath("/ky");
  redirect("/ky");
}
