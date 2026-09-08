"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isPremium } from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { draftQuoteItemsFromText } from "@/lib/ai";
import { advanceProjectStatus } from "@/lib/projectStatus";
import { defaultQuoteExpirationDate } from "@/lib/rateMaster";
import { validateDocumentFile } from "@/lib/fileValidation";
import type { PriceSource, RateCategory } from "@/generated/prisma/enums";

const RATE_CATEGORIES: RateCategory[] = [
  "LABOR",
  "FOREMAN_LABOR",
  "MACHINERY",
  "DUMP_TRUCK",
  "READY_MIX_CONCRETE",
  "CRUSHED_STONE",
  "SOIL_DISPOSAL",
  "ASPHALT",
  "CONCRETE_PRODUCT",
  "BLOCK",
  "FORMWORK",
  "SUBCONTRACT",
  "OVERHEAD",
  "OTHER",
];

export type QuoteFormState = { error?: string } | undefined;

export async function createQuoteAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const user = await requireUser();
  // AI見積書作成はプレミアム機能。UI側でも案内するが、Server Functionは直接POSTで
  // 到達可能なためここでも必ず検証する(SECURITY.md)。
  if (!isPremium(user.company)) return { error: "この機能はAIプレミアムのご契約が必要です。" };

  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const freeText = String(formData.get("freeText") ?? "").trim();

  if (!projectId) return { error: "案件を選択してください。" };
  if (!title) return { error: "見積名は必須です。" };

  // 「写真・ファイル添付」タブで選ばれたファイル。見積の作成自体を止めないよう、
  // DBへ何も作る前にここで検証しておく(不正なファイルがあれば見積を作らず差し戻す)。
  const attachedFiles = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of attachedFiles) {
    const validationError = validateDocumentFile(file);
    if (validationError) return { error: `${file.name}: ${validationError}` };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  const rateMasterItems = freeText
    ? await prisma.rateMasterItem.findMany({ where: { companyId: user.companyId } })
    : [];
  const draftItems = freeText
    ? await draftQuoteItemsFromText(freeText, rateMasterItems)
    : [];

  const quote = await prisma.quote.create({
    data: {
      companyId: user.companyId,
      projectId,
      title,
      // 資材・燃料費等は変動があるため既定3ヶ月(利用者が画面から自由に変更できる)
      expirationDate: defaultQuoteExpirationDate(),
      items: {
        create: draftItems.map((item, index) => ({
          sortOrder: index,
          itemName: item.itemName,
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.matchedRateItemId ? (item.unitPriceHint ?? 0) : 0,
          costPrice: item.matchedRateItemId ? item.costPriceHint : null,
          costCategory: item.matchedRateItemId
            ? (item.categoryHint as RateCategory)
            : null,
          priceSource: item.matchedRateItemId ? "COMPANY_RATE" : ("AI_ESTIMATE" as PriceSource),
          remarks: item.matchedRateItemId
            ? "単価マスタから自動反映(要確認)"
            : "単価不明(要確認・単価マスタに未登録)",
          rateMasterItemId: item.matchedRateItemId,
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

  // 「写真・ファイル添付」タブで選ばれたファイルを、見積の「ファイル参照」欄へ保存する
  // (uploadEntityFileActionと同じ保存先・同じ検証を、作成と同じ画面で済ませられるようにしたもの)。
  for (const file of attachedFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await prisma.entityFile.create({
      data: {
        companyId: user.companyId,
        entityType: "QUOTE",
        entityId: quote.id,
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
  const expirationDateStr = String(formData.get("expirationDate") ?? "").trim();
  const expirationDate = expirationDateStr ? new Date(expirationDateStr) : null;

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
      expirationDate,
    },
  });
  if (result.count === 0) redirect("/quotes");

  // 見積が受注になったら、現場のステータスも自動で「受注」まで進める
  // (二重入力を避けるため。現場側の手入力を上書きすることはなく、前進のみ行う)
  if (status === "ACCEPTED") {
    const quote = await prisma.quote.findUnique({ where: { id }, select: { projectId: true } });
    if (quote) await advanceProjectStatus(quote.projectId, "CONTRACTED");
  }

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
      // 複製は新しい見積として扱うため、有効期限も今日から数えて既定値に更新する
      expirationDate: defaultQuoteExpirationDate(),
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
          costCategory: item.costCategory,
          laborUnits: item.laborUnits,
          machinery: item.machinery,
          materials: item.materials,
          remarks: item.remarks,
          rateMasterItemId: item.rateMasterItemId,
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
  const costCategoryRaw = String(formData.get("costCategory") ?? "").trim();
  const costPriceRaw = String(formData.get("costPrice") ?? "").trim();
  return {
    itemName: String(formData.get("itemName") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim() || null,
    quantity: Number(formData.get("quantity") ?? 0),
    unit: String(formData.get("unit") ?? "").trim() || "式",
    unitPrice: Number(formData.get("unitPrice") ?? 0),
    priceSource,
    costPrice: costPriceRaw ? Math.round(Number(costPriceRaw)) : null,
    costCategory: RATE_CATEGORIES.includes(costCategoryRaw as RateCategory)
      ? (costCategoryRaw as RateCategory)
      : null,
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
