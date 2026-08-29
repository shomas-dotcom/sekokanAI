// 請求一覧・ダッシュボードで「入金済/入金予定/期限間近/期限超過」を一目で
// わかるようにするための判定。閾値をここで一元管理する。
export const DUE_SOON_DAYS = 7; // 支払期限の何日前から「期限間近」として警告するか

export type InvoicePaymentStatus = "PAID" | "OVERDUE" | "DUE_SOON" | "UPCOMING" | "NO_DUE_DATE";

const STATUS_LABEL: Record<InvoicePaymentStatus, string> = {
  PAID: "入金済",
  OVERDUE: "期限超過",
  DUE_SOON: "期限間近",
  UPCOMING: "入金予定",
  NO_DUE_DATE: "支払期限未設定",
};

const STATUS_COLOR: Record<InvoicePaymentStatus, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-rose-100 text-rose-700",
  DUE_SOON: "bg-amber-100 text-amber-700",
  UPCOMING: "bg-slate-100 text-slate-600",
  NO_DUE_DATE: "bg-slate-100 text-slate-500",
};

export { STATUS_LABEL as PAYMENT_STATUS_LABEL, STATUS_COLOR as PAYMENT_STATUS_COLOR };

/**
 * 発行済み(ISSUED)の請求書について、入金の状況を判定する。
 * DRAFT/CANCELLEDはこの判定の対象外(呼び出し側でstatusを先に見て除外すること)。
 */
export function computeInvoicePaymentStatus(
  invoice: { status: string; dueDate: Date | null },
  now: Date = new Date()
): InvoicePaymentStatus | null {
  if (invoice.status === "PAID") return "PAID";
  if (invoice.status !== "ISSUED") return null; // DRAFT/CANCELLEDは対象外

  if (!invoice.dueDate) return "NO_DUE_DATE";
  const dueDate = new Date(invoice.dueDate);
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < 0) return "OVERDUE";
  if (daysUntilDue <= DUE_SOON_DAYS) return "DUE_SOON";
  return "UPCOMING";
}
