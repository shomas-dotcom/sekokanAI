"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export type PhotoFormState = { error?: string } | undefined;

const VALID_PHASES = ["BEFORE", "DURING", "AFTER", "UNKNOWN"] as const;
type Phase = (typeof VALID_PHASES)[number];

export async function uploadPhotoAction(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  const file = formData.get("file");
  const phaseRaw = String(formData.get("phase") ?? "UNKNOWN");
  const phase: Phase = (VALID_PHASES as readonly string[]).includes(phaseRaw)
    ? (phaseRaw as Phase)
    : "UNKNOWN";
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const takenAtStr = String(formData.get("takenAt") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "写真を選択してください。" };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "画像ファイルを選択してください。" };
  }

  const report = await prisma.dailyReport.findFirst({
    where: { id: dailyReportId, companyId: user.companyId },
  });
  if (!report) return { error: "日報が見つかりません。" };

  const sortOrder = await prisma.dailyReportPhoto.count({ where: { dailyReportId } });
  const buffer = Buffer.from(await file.arrayBuffer());

  // EXIFのDateTimeOriginalはクライアント側(exifr)で抽出し、hidden inputで渡す。
  // 取得できなければアップロード時刻をそのまま使う(断定はしない)。
  const takenAt = takenAtStr ? new Date(takenAtStr) : new Date();

  const photo = await prisma.dailyReportPhoto.create({
    data: {
      dailyReportId,
      companyId: user.companyId,
      data: buffer,
      mimeType: file.type,
      phase,
      caption,
      takenAt,
      sortOrder,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReportPhoto.create",
    targetType: "DailyReportPhoto",
    targetId: photo.id,
  });

  revalidatePath(`/daily-reports/${dailyReportId}`);
  return undefined;
}

export async function updatePhotoPhaseAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  const phaseRaw = String(formData.get("phase") ?? "UNKNOWN");
  const phase: Phase = (VALID_PHASES as readonly string[]).includes(phaseRaw)
    ? (phaseRaw as Phase)
    : "UNKNOWN";

  await prisma.dailyReportPhoto.updateMany({
    where: { id, companyId: user.companyId },
    data: { phase },
  });

  revalidatePath(`/daily-reports/${dailyReportId}`);
}

export async function updatePhotoCaptionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim() || null;

  await prisma.dailyReportPhoto.updateMany({
    where: { id, companyId: user.companyId },
    data: { caption },
  });

  revalidatePath(`/daily-reports/${dailyReportId}`);
}

export async function deletePhotoAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");

  await prisma.dailyReportPhoto.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReportPhoto.delete",
    targetType: "DailyReportPhoto",
    targetId: id,
  });

  revalidatePath(`/daily-reports/${dailyReportId}`);
}
