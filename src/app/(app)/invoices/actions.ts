"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { recomputeInvoiceTotals, ExceedsContractAmountError } from "@/lib/invoiceTotals";
import type { BillingType } from "@/generated/prisma/enums";

export type InvoiceFormState = { error?: string } | undefined;

const BILLING_TYPES: BillingType[] = ["FULL", "DEPOSIT", "PROGRESS", "PARTIAL", "FINAL"];

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createInvoiceAction(
  _prevState: InvoiceFormState,
  formData: FormData
): Promise<InvoiceFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const contractId = String(formData.get("contractId") ?? "").trim() || null;
  const billingTypeRaw = String(formData.get("billingType") ?? "FULL") as BillingType;
  const billingType = BILLING_TYPES.includes(billingTypeRaw) ? billingTypeRaw : "FULL";
  if (!projectId) return { error: "案件を選択してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  if (contractId) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, companyId: user.companyId, projectId },
    });
    if (!contract) return { error: "契約書が見つかりません。" };
  }

  const issueDate = parseDate(formData.get("issueDate")) ?? new Date();
  const dueDate = parseDate(formData.get("dueDate"));

  const invoiceNumber = await nextDocumentNumber(user.companyId, "INVOICE");
  const invoice = await prisma.invoice.create({
    data: {
      companyId: user.companyId,
      projectId,
      contractId,
      invoiceNumber,
      issueDate,
      dueDate,
      billingType,
      taxRatePercent: project.taxRatePercent,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "invoice.create",
    targetType: "Invoice",
    targetId: invoice.id,
  });

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceMetaAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const invoice = await prisma.invoice.findFirst({ where: { id, companyId: user.companyId } });
  if (!invoice) redirect("/invoices");
  if (invoice!.status !== "DRAFT") redirect(`/invoices/${id}`);

  const billingTypeRaw = String(formData.get("billingType") ?? invoice!.billingType) as BillingType;
  const billingType = BILLING_TYPES.includes(billingTypeRaw) ? billingTypeRaw : invoice!.billingType;
  const issueDate = parseDate(formData.get("issueDate")) ?? invoice!.issueDate;
  const dueDate = parseDate(formData.get("dueDate"));
  const taxRatePercent = Number(formData.get("taxRatePercent") ?? invoice!.taxRatePercent);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          billingType,
          issueDate,
          dueDate,
          taxRatePercent: Number.isFinite(taxRatePercent) ? taxRatePercent : invoice!.taxRatePercent,
          notes,
        },
      });
      await recomputeInvoiceTotals(tx, id);
    });
  } catch (e) {
    if (e instanceof ExceedsContractAmountError) redirect(`/invoices/${id}?error=exceeds`);
    throw e;
  }

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "invoice.update",
    targetType: "Invoice",
    targetId: id,
  });

  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

// --- Invoice items ---

function readItemForm(formData: FormData) {
  return {
    itemName: String(formData.get("itemName") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim() || null,
    quantity: Number(formData.get("quantity") ?? 0),
    unit: String(formData.get("unit") ?? "").trim() || "式",
    unitPrice: Number(formData.get("unitPrice") ?? 0),
    remarks: String(formData.get("remarks") ?? "").trim() || null,
  };
}

export async function addInvoiceItemAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const data = readItemForm(formData);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: user.companyId },
    include: { _count: { select: { items: true } } },
  });
  if (!invoice || !data.itemName || invoice.status !== "DRAFT") redirect(`/invoices/${invoiceId}`);
  if (data.quantity < 0 || data.unitPrice < 0) redirect(`/invoices/${invoiceId}?error=invalid`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.create({
        data: { ...data, invoiceId, sortOrder: invoice!._count.items },
      });
      await recomputeInvoiceTotals(tx, invoiceId);
    });
  } catch (e) {
    if (e instanceof ExceedsContractAmountError) redirect(`/invoices/${invoiceId}?error=exceeds`);
    throw e;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoiceItemAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const data = readItemForm(formData);

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } });
  if (!invoice || invoice.status !== "DRAFT") redirect("/invoices");
  if (data.quantity < 0 || data.unitPrice < 0) redirect(`/invoices/${invoiceId}?error=invalid`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.updateMany({ where: { id: itemId, invoiceId }, data });
      await recomputeInvoiceTotals(tx, invoiceId);
    });
  } catch (e) {
    if (e instanceof ExceedsContractAmountError) redirect(`/invoices/${invoiceId}?error=exceeds`);
    throw e;
  }

  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteInvoiceItemAction(formData: FormData) {
  const user = await requireUser();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } });
  if (!invoice || invoice.status !== "DRAFT") redirect("/invoices");

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { id: itemId, invoiceId } });
    await recomputeInvoiceTotals(tx, invoiceId).catch((e) => {
      if (!(e instanceof ExceedsContractAmountError)) throw e;
    });
  });

  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}

export async function issueInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  try {
    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id, companyId: user.companyId },
      });
      if (invoice.status !== "DRAFT") return;

      await recomputeInvoiceTotals(tx, id);

      const full = await tx.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          items: true,
          project: { include: { customer: true } },
          contract: true,
          company: true,
        },
      });

      const snapshot = {
        invoice: full,
        confirmedAt: new Date().toISOString(),
      };

      await tx.invoice.update({
        where: { id },
        data: { status: "ISSUED", issuedSnapshotJson: JSON.stringify(snapshot) },
      });
    });
  } catch (e) {
    if (e instanceof ExceedsContractAmountError) redirect(`/invoices/${id}?error=exceeds`);
    throw e;
  }

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "invoice.issue",
    targetType: "Invoice",
    targetId: id,
  });

  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function markInvoicePaidAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const result = await prisma.invoice.updateMany({
    where: { id, companyId: user.companyId, status: "ISSUED" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (result.count > 0) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "invoice.markPaid",
      targetType: "Invoice",
      targetId: id,
    });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

export async function cancelInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  // 入金確認済み(PAID)の請求書は誤操作防止のためここでは取消できないようにする
  // (訂正が必要な場合は別途、経理上の正しい手順(赤伝票等)で対応する運用とする)
  const result = await prisma.invoice.updateMany({
    where: { id, companyId: user.companyId, status: { notIn: ["CANCELLED", "PAID"] } },
    data: { status: "CANCELLED" },
  });
  if (result.count > 0) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "invoice.cancel",
      targetType: "Invoice",
      targetId: id,
    });
  }

  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.invoice.deleteMany({ where: { id, companyId: user.companyId, status: "DRAFT" } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "invoice.delete",
    targetType: "Invoice",
    targetId: id,
  });

  revalidatePath("/invoices");
  redirect("/invoices");
}
