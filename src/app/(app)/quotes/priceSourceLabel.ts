import type { PriceSource } from "@/generated/prisma/enums";

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  COMPANY_RATE: "会社登録単価",
  PAST_ACTUAL: "過去実績単価",
  REFERENCE: "参考単価",
  AI_ESTIMATE: "AI推定(参考値)",
  MANUAL: "手動入力",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  SENT: "送付済み",
  ACCEPTED: "受注",
  REJECTED: "失注",
};
