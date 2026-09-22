"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { computeContractAmounts } from "@/lib/calc";
import { buildDefaultClauses, mergeClausesWithPast, type ContractClause } from "@/lib/contractClauses";
import { advanceProjectStatus } from "@/lib/projectStatus";
import { computeQuoteTotals } from "../quotes/totals";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import { prepareImageForVision } from "@/lib/imageConversion";
import { extractContractRequestFromImage, extractContractRequestFromPdf, type ContractRequestExtraction } from "@/lib/ai";

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

  const freshClauses = buildDefaultClauses({
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

  // 同じ顧客との直近の確定済み契約があれば、工事内容・金額・工期・支払条件の
  // 4条項は必ず新しい内容で作り直しつつ、それ以外の条項(過去に編集済みかも
  // しれない文面)と特約事項等はそのまま引き継ぐ。
  const pastContract = await prisma.contract.findFirst({
    where: {
      companyId: user.companyId,
      status: "CONFIRMED",
      project: { customerId: project.customerId },
    },
    orderBy: { contractDate: "desc" },
  });

  const clauses = mergeClausesWithPast(
    freshClauses,
    pastContract ? (JSON.parse(pastContract.clausesJson) as ContractClause[]) : null
  );

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
      warrantyTerms: pastContract?.warrantyTerms ?? null,
      delayTerms: pastContract?.delayTerms ?? null,
      cancellationTerms: pastContract?.cancellationTerms ?? null,
      specialTerms: pastContract?.specialTerms ?? null,
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
  redirect(
    pastContract
      ? `/contracts/${contract.id}?referencedContract=${encodeURIComponent(pastContract.contractNumber)}`
      : `/contracts/${contract.id}`
  );
}

export type ContractScanState =
  | { error: string; extraction?: undefined; matchedProjectId?: undefined }
  | { error?: undefined; extraction: ContractRequestExtraction; matchedProjectId: string | null }
  | undefined;

/**
 * 発注者からの注文書(画像/PDF)を読み取り、契約書作成フォームへの仮入力を作る。
 * ここではDBへの保存は一切行わない(既存のcreateContractActionが担う)。
 * 顧客名・工事名は自由記述で読み取られるため、既存の案件と部分一致で突き合わせ、
 * 一致すればプルダウンの初期選択に使う(一致しなければ手動で選択してもらう)。
 */
export async function scanContractRequestAction(
  _prevState: ContractScanState,
  formData: FormData
): Promise<ContractScanState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "注文書の画像またはPDFを選択してください。" };
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let mimeType = file.type;
  if (mimeType !== "application/pdf") {
    const prepared = await prepareImageForVision(buffer, mimeType);
    buffer = prepared.buffer;
    mimeType = prepared.mimeType;
  }

  const validationError = validateAiDocumentFile({ type: mimeType, size: buffer.length });
  if (validationError) return { error: validationError };

  const base64 = buffer.toString("base64");
  const usageContext = { companyId: user.companyId, userId: user.id, feature: "contract.scanRequest" };
  const extraction =
    mimeType === "application/pdf"
      ? await extractContractRequestFromPdf(base64, usageContext)
      : await extractContractRequestFromImage(
          base64,
          mimeType as "image/jpeg" | "image/png" | "image/webp",
          usageContext
        );

  if (extraction.confidence === "unavailable") {
    return {
      error:
        "読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。もう一度お試しいただくか、手入力してください。",
    };
  }

  let matchedProjectId: string | null = null;
  if (extraction.customerName) {
    const matched = await prisma.project.findFirst({
      where: { companyId: user.companyId, customer: { name: { contains: extraction.customerName, mode: "insensitive" } } },
      select: { id: true },
    });
    matchedProjectId = matched?.id ?? null;
  }
  if (!matchedProjectId && extraction.projectName) {
    const matched = await prisma.project.findFirst({
      where: { companyId: user.companyId, name: { contains: extraction.projectName, mode: "insensitive" } },
      select: { id: true },
    });
    matchedProjectId = matched?.id ?? null;
  }

  await logAction({ companyId: user.companyId, userId: user.id, action: "contract.scanRequest" });

  return { extraction, matchedProjectId };
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

  // 契約確定で現場は「施工中」まで自動的に進める(二重入力を避けるため。前進のみ)
  await advanceProjectStatus(contract.projectId, "IN_PROGRESS");

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
