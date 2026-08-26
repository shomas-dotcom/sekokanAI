import type { ContractStatus } from "@/generated/prisma/enums";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定済み",
  CANCELLED: "取消",
};

export const CONTRACT_STATUS_COLOR: Record<ContractStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};
