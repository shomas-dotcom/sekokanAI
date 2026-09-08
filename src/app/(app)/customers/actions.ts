"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import {
  extractBusinessCardFromImage,
  extractBusinessCardFromPdf,
  extractCustomerFieldsFromText,
  type BusinessCardExtraction,
} from "@/lib/ai";

export type CustomerFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    contactName: String(formData.get("contactName") ?? "").trim() || null,
    position: String(formData.get("position") ?? "").trim() || null,
    department: String(formData.get("department") ?? "").trim() || null,
    postalCode: String(formData.get("postalCode") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    mobilePhone: String(formData.get("mobilePhone") ?? "").trim() || null,
    fax: String(formData.get("fax") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export type DuplicateCustomer = { id: string; name: string; phone: string | null; email: string | null };
export type BusinessCardScanState =
  | { error: string; extraction?: undefined; duplicates?: undefined }
  | { error?: undefined; extraction: BusinessCardExtraction; duplicates: DuplicateCustomer[] }
  | undefined;

/**
 * 名刺の画像をAIに読み取らせ、下書き(仮入力用のデータ)を返すだけの処理。
 * ここではDBへの保存は一切行わない(OCR→AI項目判定→仮入力→ユーザー確認→登録、の
 * 「確認」より前の段階であるため。実際の保存は既存のcreateCustomerActionが担う)。
 */
export async function scanBusinessCardAction(
  _prevState: BusinessCardScanState,
  formData: FormData
): Promise<BusinessCardScanState> {
  const user = await requireUser();
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "名刺の画像またはPDFを選択してください。" };
  }
  const validationError = validateAiDocumentFile(file);
  if (validationError) return { error: validationError };

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const usageContext = { companyId: user.companyId, userId: user.id, feature: "businessCard.scan" };
  const extraction =
    file.type === "application/pdf"
      ? await extractBusinessCardFromPdf(base64, usageContext)
      : await extractBusinessCardFromImage(
          base64,
          file.type as "image/jpeg" | "image/png" | "image/webp",
          usageContext
        );

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "名刺を読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。もう一度お試しいただくか、手入力してください。",
    };
  }

  // 重複候補: 会社名の部分一致、または電話番号・メールアドレスの完全一致
  const orConditions: Array<Record<string, unknown>> = [];
  if (extraction.companyName) {
    orConditions.push({ name: { contains: extraction.companyName, mode: "insensitive" } });
  }
  if (extraction.phone) orConditions.push({ phone: extraction.phone });
  if (extraction.mobilePhone) orConditions.push({ phone: extraction.mobilePhone });
  if (extraction.email) orConditions.push({ email: extraction.email });

  const duplicates =
    orConditions.length > 0
      ? await prisma.customer.findMany({
          where: { companyId: user.companyId, OR: orConditions },
          select: { id: true, name: true, phone: true, email: true },
          take: 5,
        })
      : [];

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.scanBusinessCard",
  });

  return { extraction, duplicates };
}

export async function createCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser();
  const data = readForm(formData);
  if (!data.name) return { error: "顧客名は必須です。" };

  const customer = await prisma.customer.create({
    data: { ...data, companyId: user.companyId },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.create",
    targetType: "Customer",
    targetId: customer.id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const data = readForm(formData);
  if (!data.name) return { error: "顧客名は必須です。" };

  // companyId をwhere句に含めることで他社の顧客を更新できないようにする
  const result = await prisma.customer.updateMany({
    where: { id, companyId: user.companyId },
    data,
  });
  if (result.count === 0) return { error: "顧客が見つかりません。" };

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.update",
    targetType: "Customer",
    targetId: id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomerAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.customer.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "customer.delete",
    targetType: "Customer",
    targetId: id,
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export type CustomerVoiceFillState = { error?: string; extraction?: BusinessCardExtraction } | undefined;

/**
 * 「まとめて音声入力する」欄。名刺撮影と同じ項目・同じ確認フローになるよう、
 * 抽出結果の形はBusinessCardExtractionをそのまま使う。ここでもDB保存はしない。
 */
export async function scanCustomerVoiceAction(
  _prevState: CustomerVoiceFillState,
  formData: FormData
): Promise<CustomerVoiceFillState> {
  const user = await requireUser();
  const transcript = String(formData.get("transcript") ?? "").trim();
  if (!transcript) return { error: "マイクで話すか、内容を入力してください。" };

  const extraction = await extractCustomerFieldsFromText(transcript, {
    companyId: user.companyId,
    userId: user.id,
    feature: "customer.voiceExtract",
  });
  return { extraction };
}
