"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { draftQuoteItemsFromText } from "@/lib/ai";
import type { PriceSource } from "@/generated/prisma/enums";

export type QuoteFormState = { error?: string } | undefined;

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const freeText = String(formData.get("freeText") ?? "").trim();

  if (!projectId) return { error: "案件を選択してください。" };
  if (!title) return { error: "見積名は必須です。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  const draftItems = freeText ? await draftQuoteItemsFromText(freeText) : [];

  const quote = await prisma.quote.create({
    data: {
      companyId: user.companyId,
      projectId,
      title,
      items: {
        create: draftItems.map((item, index) => ({
          sortOrder: index,
          itemName: item.itemName,
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: 0,
          priceSource: "AI_ESTIMATE" as PriceSource,
          remarks: "AIによる下書き(要確認・単価は参考値ではなく未設定)",
        })),
      },
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "quote.create",
    targetType: "Quote",
    targetId: quote.id,
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuoteMetaAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "DRAFT");
  const taxRatePercent = Number(formData.get("taxRatePercent") ?? 10);
  const discountAmount = Number(formData.get("discountAmount") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // 見積名が空の場合は変更を保存せず詳細ページへ戻す(HTML側のrequired属性が主な防止策)
  if (!title) redirect(`/quotes/${id}`);

  const result = await prisma.quote.updateMany({
    where: { id, companyId: user.companyId },
    data: {
      title,
      status: status as never,
      taxRatePercent: Number.isFinite(taxRatePercent) ? taxRatePercent : 10,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      notes,
    },
  });
  if (result.count === 0) redirect("/quotes");

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "quote.update",
    targetType: "Quote",
    targetId: id,
  });

  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function deleteQuoteAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.quote.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "quote.delete",
    targetType: "Quote",
    targetId: id,
  });

  revalidatePath("/quotes");
  redirect("/quotes");
}

export async function duplicateQuoteAction(formData: FormData) {
  const user = await requireUser();
  const sourceId = String(formData.get("id") ?? "");

  const source = await prisma.quote.findFirst({
    where: { id: sourceId, companyId: user.companyId },
    include: { items: true },
  });
  if (!source) redirect("/quotes");

  const copy = await prisma.quote.create({
    data: {
      companyId: user.companyId,
      projectId: source.projectId,
      title: `${source.title}(複製)`,
      taxRatePercent: source.taxRatePercent,
      discountAmount: source.discountAmount,
      notes: source.notes,
      duplicatedFromId: source.id,
      items: {
        create: source.items.map((item, index) => ({
          sortOrder: index,
          itemName: item.itemName,
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          priceSource: item.priceSource,
          costPrice: item.costPrice,
          laborUnits: item.laborUnits,
          machinery: item.machinery,
          materials: item.materials,
          remarks: item.remarks,
        })),
      },
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "quote.duplicate",
    targetType: "Quote",
    targetId: copy.id,
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${copy.id}`);
}

// --- Quote items ---

function readItemForm(formData: FormData) {
  const priceSource = String(formData.get("priceSource") ?? "MANUAL") as PriceSource;
  return {
    itemName: String(formData.get("itemName") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim() || null,
    quantity: Number(formData.get("quantity") ?? 0),
    unit: String(formData.get("unit") ?? "").trim() || "式",
    unitPrice: Number(formData.get("unitPrice") ?? 0),
    priceSource,
    remarks: String(formData.get("remarks") ?? "").trim() || null,
  };
}

export async function addQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get("quoteId") ?? "");
  const data = readItemForm(formData);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: user.companyId },
    include: { _count: { select: { items: true } } },
  });
  if (!quote || !data.itemName) redirect(`/quotes/${quoteId}`);

  await prisma.quoteItem.create({
    data: { ...data, quoteId, sortOrder: quote!._count.items },
  });

  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}`);
}

export async function updateQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get("quoteId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const data = readItemForm(formData);

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, companyId: user.companyId } });
  if (!quote) redirect("/quotes");

  await prisma.quoteItem.updateMany({ where: { id: itemId, quoteId }, data });

  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}`);
}

export async function deleteQuoteItemAction(formData: FormData) {
  const user = await requireUser();
  const quoteId = String(formData.get("quoteId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, companyId: user.companyId } });
  if (!quote) redirect("/quotes");

  await prisma.quoteItem.deleteMany({ where: { id: itemId, quoteId } });

  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}`);
}
