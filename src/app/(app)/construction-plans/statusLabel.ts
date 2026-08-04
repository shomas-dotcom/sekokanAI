export const SECTION_STATUS_LABEL: Record<string, string> = {
  NEEDS_INPUT: "未入力",
  DRAFTED: "下書き済み",
  NEEDS_CONFIRMATION: "要確認(AI整形)",
  CONFIRMED: "確認済み",
};

export const SECTION_STATUS_COLOR: Record<string, string> = {
  NEEDS_INPUT: "bg-slate-100 text-slate-600",
  DRAFTED: "bg-sky-50 text-sky-700",
  NEEDS_CONFIRMATION: "bg-indigo-50 text-indigo-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
};
