// 出面の労務原価・請求額・粗利の集計(調査報告F10: 原価と請求単価を分ける)。
// 単価が未入力の行は0円として足さず、「未入力の件数」として別に数える。
// 未入力が1件でもある集まりは粗利を出さない(見かけだけの利益を表示しないため)。

export type SiteAttendanceAmountRow = {
  manDays: number;
  isBillable: boolean;
  isCostTarget: boolean;
  manDayUnitPrice: number | null; // 請求単価
  laborCostUnitPrice: number | null; // 原価単価
};

export type SiteAttendanceAmountTotals = {
  laborCost: number;
  laborCostMissing: number;
  billing: number;
  billingMissing: number;
  /** 原価・請求の未入力がなければ 請求額−労務原価。未入力があればnull(出さない)。 */
  grossProfit: number | null;
};

export function amountOf(manDays: number, unitPrice: number | null): number | null {
  return unitPrice == null ? null : Math.round(manDays * unitPrice);
}

export function emptyTotals(): SiteAttendanceAmountTotals {
  return { laborCost: 0, laborCostMissing: 0, billing: 0, billingMissing: 0, grossProfit: null };
}

export function addToTotals(totals: SiteAttendanceAmountTotals, row: SiteAttendanceAmountRow): void {
  if (row.isCostTarget) {
    const cost = amountOf(row.manDays, row.laborCostUnitPrice);
    if (cost == null) totals.laborCostMissing += 1;
    else totals.laborCost += cost;
  }
  if (row.isBillable) {
    const billing = amountOf(row.manDays, row.manDayUnitPrice);
    if (billing == null) totals.billingMissing += 1;
    else totals.billing += billing;
  }
  totals.grossProfit =
    totals.laborCostMissing === 0 && totals.billingMissing === 0 ? totals.billing - totals.laborCost : null;
}

export function sumRows(rows: SiteAttendanceAmountRow[]): SiteAttendanceAmountTotals {
  const totals = emptyTotals();
  for (const row of rows) addToTotals(totals, row);
  return totals;
}

/**
 * 画面から受け取った単価を検証する。空欄はnull(未入力)。0以上の整数以外は不正としてundefinedを返す
 * (マイナスや小数で金額が狂うのを防ぐ)。
 */
export function parseUnitPrice(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) return undefined;
  return value;
}
