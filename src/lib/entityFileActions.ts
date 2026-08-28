"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateDocumentFile } from "@/lib/fileValidation";
import type { FileEntityType } from "@/generated/prisma/enums";

export type EntityFileFormState = { error?: string } | undefined;

const ENTITY_BASE_PATH: Record<FileEntityType, string> = {
  CUSTOMER: "/customers",
  QUOTE: "/quotes",
  CONTRACT: "/contracts",
  INVOICE: "/invoices",
  EMPLOYEE: "/employees",
};

function isFileEntityType(value: string): value is FileEntityType {
  return value in ENTITY_BASE_PATH;
}

// entityIdが本当に自社(companyId)のものかを、対象ごとに確認する。EntityFileは
// Prismaの多態関連(真の外部キー)を張れないため、ここで必ずテナント分離を担保する。
async function verifyEntityBelongsToCompany(
  entityType: FileEntityType,
  entityId: string,
  companyId: string
): Promise<boolean> {
  switch (entityType) {
    case "CUSTOMER":
      return Boolean(await prisma.customer.findFirst({ where: { id: entityId, companyId } }));
    case "QUOTE":
      return Boolean(await prisma.quote.findFirst({ where: { id: entityId, companyId } }));
    case "CONTRACT":
      return Boolean(await prisma.contract.findFirst({ where: { id: entityId, companyId } }));
    case "INVOICE":
      return Boolean(await prisma.invoice.findFirst({ where: { id: entityId, companyId } }));
    case "EMPLOYEE":
      return Boolean(await prisma.employee.findFirst({ where: { id: entityId, companyId } }));
  }
}

/**
 * 顧客・見積・契約書・請求書・従業員の各詳細画面「ファイル参照」タブ共通のアップロード処理。
 * 中身をAIが読み取ったりはしない(単なる参照保管場所)。
 */
export async function uploadEntityFileAction(
  _prevState: EntityFileFormState,
  formData: FormData
): Promise<EntityFileFormState> {
  const user = await requireUser();
  const entityTypeRaw = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!isFileEntityType(entityTypeRaw)) return { error: "不正な種別です。" };
  if (!entityId) return { error: "対象が指定されていません。" };
  if (files.length === 0) return { error: "ファイルを選択してください。" };

  const ok = await verifyEntityBelongsToCompany(entityTypeRaw, entityId, user.companyId);
  if (!ok) return { error: "対象が見つかりません。" };

  for (const file of files) {
    const validationError = validateDocumentFile(file);
    if (validationError) return { error: `${file.name}: ${validationError}` };
  }

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await prisma.entityFile.create({
      data: {
        companyId: user.companyId,
        entityType: entityTypeRaw,
        entityId,
        fileName: file.name,
        mimeType: file.type,
        data: buffer,
        size: file.size,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "entityFile.create",
      targetType: "EntityFile",
      targetId: saved.id,
    });
  }

  revalidatePath(`${ENTITY_BASE_PATH[entityTypeRaw]}/${entityId}`);
  return undefined;
}

export async function deleteEntityFileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const entityTypeRaw = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");

  await prisma.entityFile.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "entityFile.delete",
    targetType: "EntityFile",
    targetId: id,
  });

  if (isFileEntityType(entityTypeRaw)) {
    revalidatePath(`${ENTITY_BASE_PATH[entityTypeRaw]}/${entityId}`);
  }
}
