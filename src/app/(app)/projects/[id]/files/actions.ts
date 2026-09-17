"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateDocumentFile } from "@/lib/fileValidation";
import { prepareImageForStorage } from "@/lib/imageConversion";

export type ProjectFileFormState = { error?: string } | undefined;

// 過去の見積書・仕様書などを、案件に紐づけて置いておくための資料アップロード。
// ここに置いたファイルの中身をAIが読み取ったりはしない(単なる参照保管場所)。
export async function uploadProjectFileAction(
  _prevState: ProjectFileFormState,
  formData: FormData
): Promise<ProjectFileFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "ファイルを選択してください。" };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  for (const file of files) {
    const validationError = validateDocumentFile(file);
    if (validationError) {
      return { error: `${file.name}: ${validationError}` };
    }
  }

  for (const file of files) {
    // HEIC/HEIFはiPhone以外の端末(Android・Windows等)のブラウザで表示できないことが
    // 多いため、社内の他の人も開けるようJPEGへ変換してから保存する。
    const { buffer, mimeType, fileName } = await prepareImageForStorage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      file.name
    );
    const saved = await prisma.projectFile.create({
      data: {
        companyId: user.companyId,
        projectId,
        fileName,
        mimeType,
        data: buffer,
        size: buffer.length,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "projectFile.create",
      targetType: "ProjectFile",
      targetId: saved.id,
    });
  }

  revalidatePath(`/projects/${projectId}`);
  return undefined;
}

export async function deleteProjectFileAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  await prisma.projectFile.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "projectFile.delete",
    targetType: "ProjectFile",
    targetId: id,
  });

  revalidatePath(`/projects/${projectId}`);
}
