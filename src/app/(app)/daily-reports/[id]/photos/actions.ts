"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateImageFile, validateVisionImageFile } from "@/lib/fileValidation";
import { suggestPhotoMetadataFromImage, type PhotoMetadataExtraction } from "@/lib/ai";

export type PhotoFormState = { error?: string } | undefined;

const VALID_PHASES = ["BEFORE", "DURING", "AFTER", "UNKNOWN"] as const;
type Phase = (typeof VALID_PHASES)[number];

export type PhotoSuggestState = { suggestion?: PhotoMetadataExtraction; error?: string } | undefined;

// 写真をアップロードする前に、AIに「施工前/中/後」とコメントを提案してもらう。
// ここではDBに何も保存しない — あくまでアップロードフォームへの仮入力用の提案で、
// 実際に保存するかどうか・内容を直すかどうかは、この後ユーザーが決める
// (uploadPhotoActionでユーザーが確認した値がそのまま保存される)。
export async function suggestPhotoMetadataAction(
  _prevState: PhotoSuggestState,
  formData: FormData
): Promise<PhotoSuggestState> {
  await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "写真を選択してください。" };
  }
  const validationError = validateVisionImageFile(file);
  if (validationError) return { error: validationError };

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const suggestion = await suggestPhotoMetadataFromImage(
    base64,
    file.type as "image/jpeg" | "image/png" | "image/webp"
  );

  if (suggestion.confidence === "unavailable") {
    return {
      error:
        "写真の内容を判定できませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。施工前/中/後・コメントは手動で選んでください。",
    };
  }

  return { suggestion };
}

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
  const validationError = validateImageFile(file);
  if (validationError) {
    return { error: validationError };
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
