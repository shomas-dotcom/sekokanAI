import { amountOf } from "@/lib/timesheet/siteAttendanceTotals";

// 現場別の原価(労務費・機械費)の集計。日報から作られた出面(労務)と経費(機械)を足し合わせる。
// 既存の出面集計と同じ決まりにする: 単価が未登録の行は0円として足さず、件数として別に数える。
// 画面には「未登録があるため、実際はこれより多い」と出す(見かけの原価を小さく見せないため)。

export type LaborCostRow = {
  key: string; // 集計のキー(現場・日付・作業員など。呼び出し側が決める)
  manDays: number;
  isCostTarget: boolean;
  laborCostUnitPrice: number | null;
};

export type MachineCostRow = {
  key: string;
  amount: number | null;
  isCostTarget: boolean;
};

export type CostTotals = {
  manDays: number;
  labor: number;
  laborMissing: number;
  machine: number;
  machineMissing: number;
  total: number;
};

export function emptyCost(): CostTotals {
  return { manDays: 0, labor: 0, laborMissing: 0, machine: 0, machineMissing: 0, total: 0 };
}

export function addLaborRow(totals: CostTotals, row: Omit<LaborCostRow, "key">): void {
  // 人工数は、原価の対象でない行(請求だけの応援など)も数える。金額は原価の対象だけ。
  totals.manDays = Math.round((totals.manDays + row.manDays) * 100) / 100;
  if (!row.isCostTarget) return;
  const cost = amountOf(row.manDays, row.laborCostUnitPrice);
  if (cost == null) totals.laborMissing += 1;
  else totals.labor += cost;
  totals.total = totals.labor + totals.machine;
}

export function addMachineRow(totals: CostTotals, row: Omit<MachineCostRow, "key">): void {
  if (!row.isCostTarget) return;
  if (row.amount == null) totals.machineMissing += 1;
  else totals.machine += row.amount;
  totals.total = totals.labor + totals.machine;
}

/** キーごとに集計する(例: 現場ごと・日付ごと・作業員ごと)。キーの並びは、最初に出てきた順。 */
export function aggregateCosts(labor: LaborCostRow[], machines: MachineCostRow[]): Map<string, CostTotals> {
  const result = new Map<string, CostTotals>();
  const get = (key: string) => {
    let totals = result.get(key);
    if (!totals) {
      totals = emptyCost();
      result.set(key, totals);
    }
    return totals;
  };
  for (const row of labor) addLaborRow(get(row.key), row);
  for (const row of machines) addMachineRow(get(row.key), row);
  return result;
}

export function sumAll(values: Iterable<CostTotals>): CostTotals {
  const total = emptyCost();
  for (const v of values) {
    total.manDays = Math.round((total.manDays + v.manDays) * 100) / 100;
    total.labor += v.labor;
    total.laborMissing += v.laborMissing;
    total.machine += v.machine;
    total.machineMissing += v.machineMissing;
  }
  total.total = total.labor + total.machine;
  return total;
}

/** 日本時間の暦日("YYYY-MM-DD")。日報の日付は日本時間の日付として保存されている。 */
export function jstDateKey(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function jstMonthKey(date: Date): string {
  return jstDateKey(date).slice(0, 7);
}
