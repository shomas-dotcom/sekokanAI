import type { InvoiceStatus, BillingType } from "@/generated/prisma/enums";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "下書き",
  ISSUED: "発行済み",
  CANCELLED: "取消",
};

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  FULL: "全額請求",
  DEPOSIT: "着手金",
  PROGRESS: "中間金・出来高請求",
  PARTIAL: "一部請求",
  FINAL: "完成時請求",
};
