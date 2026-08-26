import { prisma } from "@/lib/prisma";
import { computeInvoiceItemsTotal, computeBillingProgress } from "@/lib/calc";
import type { RoundingModeValue } from "@/lib/calc";

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export class ExceedsContractAmountError extends Error {
  constructor(public remainingAmount: number) {
    super("累計請求額が契約金額(税込)を超えるため保存できません。");
  }
}

/**
 * 請求書の明細から小計・消費税・合計を再計算し、契約に紐づく場合は
 * 前回請求額・累計請求額・残額も再計算してDBへ反映する。
 * 累計請求額が契約金額(税込)を超える場合はExceedsContractAmountErrorを投げ、
 * 呼び出し側のトランザクションをロールバックさせる(REQUIREMENTS.md #10)。
 */
export async function recomputeInvoiceTotals(tx: TxClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: true },
  });

  const { subtotal, tax, total } = computeInvoiceItemsTotal(
    invoice.items,
    invoice.taxRatePercent,
    invoice.roundingMode as RoundingModeValue
  );

  let previousBilledAmount = 0;
  let cumulativeBilledAmount = total;
  let remainingAmount = 0;
  let exceeds = false;

  if (invoice.contractId) {
    const contract = await tx.contract.findUniqueOrThrow({ where: { id: invoice.contractId } });
    const others = await tx.invoice.findMany({
      where: {
        contractId: invoice.contractId,
        id: { not: invoiceId },
        // 入金確認済み(PAID)の請求書も、発行済みとして累計請求額に数え続ける
        status: { in: ["ISSUED", "PAID"] },
      },
      select: { currentBilledAmount: true },
    });
    previousBilledAmount = others.reduce((sum, o) => sum + o.currentBilledAmount, 0);

    const progress = computeBillingProgress({
      contractAmountIncludingTax: contract.contractAmountIncludingTax,
      previousBilledAmount,
      currentBilledAmount: total,
    });
    cumulativeBilledAmount = progress.cumulativeBilledAmount;
    remainingAmount = progress.remainingAmount;
    exceeds = progress.exceedsContractAmount;
  }

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal,
      taxAmount: tax,
      total,
      currentBilledAmount: total,
      previousBilledAmount,
      cumulativeBilledAmount,
      remainingAmount,
    },
  });

  if (exceeds && invoice.status !== "CANCELLED") {
    throw new ExceedsContractAmountError(remainingAmount);
  }
}
