"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { computeContractAmounts } from "@/lib/calc";
import { buildDefaultClauses, type ContractClause } from "@/lib/contractClauses";
import { computeQuoteTotals } from "../quotes/totals";

export type ContractFormState = { error?: string } | undefined;

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createContractAction(
  _prevState: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "").trim() || null;
  if (!projectId) return { error: "案件を選択してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    include: { customer: true },
  });
  if (!project) return { error: "案件が見つかりません。" };

  let contractAmountExcludingTax: number;
  let taxRatePercent: number;

  if (quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, companyId: user.companyId, projectId },
      include: { items: true },
    });
    if (!quote) return { error: "見積が見つかりません。" };
    const totals = computeQuoteTotals(quote.items, quote.taxRatePercent, quote.discountAmount);
    contractAmountExcludingTax = totals.afterDiscount;
    taxRatePercent = quote.taxRatePercent;
  } else {
    const amount = Number(formData.get("contractAmountExcludingTax") ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "契約金額(税抜)を正しく入力してください。" };
    }
    contractAmountExcludingTax = Math.round(amount);
    const rate = Number(formData.get("taxRatePercent") ?? project.taxRatePercent);
    taxRatePercent = Number.isFinite(rate) ? rate : 10;
  }

  const contractDate = parseDate(formData.get("contractDate")) ?? new Date();
  const startDate = parseDate(formData.get("startDate")) ?? project.startDate;
  const endDate = parseDate(formData.get("endDate")) ?? project.endDate;
  if (startDate && endDate && startDate > endDate) {
    return { error: "工期の開始日は終了日より前の日付にしてください。" };
  }
  const paymentTerms =
    String(formData.get("paymentTerms") ?? "").trim() || project.paymentTerms || null;

  const { taxAmount, contractAmountIncludingTax } = computeContractAmounts(
    contractAmountExcludingTax,
    taxRatePercent
  );

  const clauses = buildDefaultClauses({
    projectName: project.name,
    siteAddress: project.siteAddress,
    overview: project.overview,
    contractAmountExcludingTax,
    taxAmount,
    contractAmountIncludingTax,
    startDate,
    endDate,
    paymentTerms,
  });

  const contractNumber = await nextDocumentNumber(user.companyId, "CONTRACT");

  const contract = await prisma.contract.create({
    data: {
      companyId: user.companyId,
      projectId,
      quoteId,
      contractNumber,
      contractDate,
      contractAmountExcludingTax,
      taxRatePercent,
      taxAmount,
      contractAmountIncludingTax,
      startDate,
      endDate,
      paymentTerms,
      clausesJson: JSON.stringify(clauses),
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "contract.create",
    targetType: "Contract",
    targetId: contract.id,
  });

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function updateContractMetaAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const contract = await prisma.contract.findFirst({ where: { id, companyId: user.companyId } });
  if (!contract) redirect("/contracts");
  if (contract!.status !== "DRAFT") redirect(`/contracts/${id}`);

  const amount = Number(formData.get("contractAmountExcludingTax") ?? contract!.contractAmountExcludingTax);
  const taxRatePercent = Number(formData.get("taxRatePercent") ?? contract!.taxRatePercent);
  const contractAmountExcludingTax = Number.isFinite(amount)
    ? Math.round(amount)
    : contract!.contractAmountExcludingTax;
  const { taxAmount, contractAmountIncludingTax } = computeContractAmounts(
    contractAmountExcludingTax,
    Number.isFinite(taxRatePercent) ? taxRatePercent : contract!.taxRatePercent
  );

  const contractDate = parseDate(formData.get("contractDate")) ?? contract!.contractDate;
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  if (startDate && endDate && startDate > endDate) redirect(`/contracts/${id}`);

  await prisma.contract.update({
    where: { id },
    data: {
      contractDate,
      contractAmountExcludingTax,
      taxRatePercent: Number.isFinite(taxRatePercent) ? taxRatePercent : contract!.taxRatePercent,
      taxAmount,
      contractAmountIncludingTax,
      startDate,
      endDate,
      paymentTerms: String(formData.get("paymentTerms") ?? "").trim() || null,
      warrantyTerms: String(formData.get("warrantyTerms") ?? "").trim() || null,
      delayTerms: String(formData.get("delayTerms") ?? "").trim() || null,
      cancellationTerms: String(formData.get("cancellationTerms") ?? "").trim() || null,
      specialTerms: String(formData.get("specialTerms") ?? "").trim() || null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "contract.update",
    targetType: "Contract",
    targetId: id,
  });

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}`);
}

export async function updateContractClausesAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const contract = await prisma.contract.findFirst({ where: { id, companyId: user.companyId } });
  if (!contract) redirect("/contracts");
  if (contract!.status !== "DRAFT") redirect(`/contracts/${id}`);

  const clauses: ContractClause[] = (JSON.parse(contract!.clausesJson) as ContractClause[]).map(
    (clause) => ({
      ...clause,
      text: String(formData.get(`clause_${clause.key}`) ?? clause.text),
    })
  );

  await prisma.contract.update({ where: { id }, data: { clausesJson: JSON.stringify(clauses) } });

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}`);
}

export async function confirmContractAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { include: { customer: true } }, company: true },
  });
  if (!contract) redirect("/contracts");
  if (contract.status !== "DRAFT") redirect(`/contracts/${id}`);

  const snapshot = {
    contract: { ...contract, company: undefined, project: undefined },
    project: contract.project,
    customer: contract.project.customer,
    company: contract.company,
    clauses: JSON.parse(contract.clausesJson) as ContractClause[],
    confirmedAt: new Date().toISOString(),
  };

  await prisma.contract.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedSnapshotJson: JSON.stringify(snapshot) },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "contract.confirm",
    targetType: "Contract",
    targetId: id,
  });

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}`);
}

export async function cancelContractAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const result = await prisma.contract.updateMany({
    where: { id, companyId: user.companyId, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED" },
  });
  if (result.count > 0) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "contract.cancel",
      targetType: "Contract",
      targetId: id,
    });
  }

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}`);
}

export async function deleteContractAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.contract.deleteMany({ where: { id, companyId: user.companyId, status: "DRAFT" } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "contract.delete",
    targetType: "Contract",
    targetId: id,
  });

  revalidatePath("/contracts");
  redirect("/contracts");
}
