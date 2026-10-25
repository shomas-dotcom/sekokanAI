import { prisma } from "@/lib/prisma";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { normalizeName, STANDARD_HAZARDS, STANDARD_MACHINES, STANDARD_WORK_ITEMS } from "./standardMasters";
import type { LaborCategory, MachineOwnership, MachinePriceUnit } from "@/generated/prisma/enums";

/**
 * 会社に、標準の作業内容・使用機械・KYを入れる(会社ごとに1回だけ)。
 * - すでに会社が登録している作業内容は消さない・変えない。標準項目のうち同じ名前のものがなければ足す。
 * - 入れたあとに会社が消した・無効にした項目は、次回以降に復活させない(入れた日時を記録して1回きりにする)。
 * - 同時に2つの画面から呼ばれても二重に入らない(入れた日時の記録を先に取った1回だけが入れる)。
 * 機械の単価は入れない(単価表に無いものは勝手に決めない。管理者が登録する)。
 */
export async function ensureDailyReportMasters(companyId: string): Promise<void> {
  const settings = await getOrCreateWorkSettings(companyId);
  if (settings.dailyMastersSeededAt) return;

  await prisma.$transaction(
    async (tx) => {
      // 入れた日時が空のときだけ記録できる。同時に来た別の処理は、ここで待たされたあと0件更新になり何もしない。
      const claimed = await tx.companyWorkSettings.updateMany({
        where: { companyId, dailyMastersSeededAt: null },
        data: { dailyMastersSeededAt: new Date() },
      });
      if (claimed.count === 0) return;

      const [works, machines, hazards] = await Promise.all([
        tx.workItemMaster.findMany({ where: { companyId }, select: { label: true, sortOrder: true } }),
        tx.machineMaster.findMany({ where: { companyId }, select: { name: true } }),
        tx.kyHazardMaster.findMany({ where: { companyId }, select: { label: true } }),
      ]);

      const workNames = new Set(works.map((w) => normalizeName(w.label)));
      const startOrder = works.reduce((max, w) => Math.max(max, w.sortOrder), 0) + 1;
      const newWorks = STANDARD_WORK_ITEMS.filter((w) => !workNames.has(normalizeName(w.label)));
      if (newWorks.length > 0) {
        await tx.workItemMaster.createMany({
          data: newWorks.map((w, i) => ({
            companyId,
            label: w.label,
            defaultUnit: w.defaultUnit,
            sortOrder: startOrder + i,
          })),
        });
      }

      const machineNames = new Set(machines.map((m) => normalizeName(m.name)));
      const newMachines = STANDARD_MACHINES.filter((name) => !machineNames.has(normalizeName(name)));
      if (newMachines.length > 0) {
        await tx.machineMaster.createMany({
          data: newMachines.map((name, i) => ({ companyId, name, sortOrder: i })),
        });
      }

      const hazardNames = new Set(hazards.map((h) => normalizeName(h.label)));
      const newHazards = STANDARD_HAZARDS.filter((h) => !hazardNames.has(normalizeName(h.label)));
      if (newHazards.length > 0) {
        await tx.kyHazardMaster.createMany({
          data: newHazards.map((h, i) => ({
            companyId,
            label: h.label,
            measuresJson: JSON.stringify(h.measures),
            sortOrder: i,
          })),
        });
      }
    },
    { timeout: 30_000 }
  );
}

/** 入力画面の並び順: お気に入りを先頭に、そのあとは並び順・登録順。 */
export const MASTER_ORDER = [{ isFavorite: "desc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }];

export function parseMeasures(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((m): m is string => typeof m === "string" && m.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export type QuickMasterData = {
  works: { id: string; label: string; defaultUnit: string | null; isFavorite: boolean }[];
  machines: {
    id: string;
    name: string;
    ownership: MachineOwnership;
    priceUnit: MachinePriceUnit;
    includesOperator: boolean;
    isFavorite: boolean;
    /** 単価は管理者にだけ渡す(一般の利用者の画面には金額の情報を一切送らない)。 */
    unitPrice: number | null;
  }[];
  hazards: { id: string; label: string; measures: string[]; isFavorite: boolean }[];
  employees: { id: string; name: string; position: string | null }[];
  /** 管理者だけに渡す。区分ごと・従業員ごとの労務単価(1人工あたり)。 */
  laborRates: { byCategory: Partial<Record<LaborCategory, number>>; byEmployee: Record<string, number> } | null;
  manDayBaseMinutes: number;
  canSeeCosts: boolean;
};

/** かんたん入力の画面に渡すマスタを読み込む。必要なら先に標準項目を入れる。会社のデータだけを返す。 */
export async function loadQuickMasters(user: { companyId: string; role: string }): Promise<QuickMasterData> {
  await ensureDailyReportMasters(user.companyId);
  const companyId = user.companyId;
  const canSeeCosts = user.role === "ADMIN";

  const [works, machines, hazards, employees, settings, categoryRates, employeeRates] = await Promise.all([
    prisma.workItemMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
    prisma.machineMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
    prisma.kyHazardMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
    prisma.employee.findMany({
      where: { companyId },
      select: { id: true, name: true, position: true },
      // 従業員の画面に登録した順。名前のボタンもこの順に並ぶ(並びを変えたいときは登録順で決まる)。
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    }),
    getOrCreateWorkSettings(companyId),
    canSeeCosts ? prisma.laborCategoryRate.findMany({ where: { companyId } }) : Promise.resolve([]),
    canSeeCosts ? prisma.employeeLaborRate.findMany({ where: { companyId } }) : Promise.resolve([]),
  ]);

  return {
    works: works.map((w) => ({ id: w.id, label: w.label, defaultUnit: w.defaultUnit, isFavorite: w.isFavorite })),
    machines: machines.map((m) => ({
      id: m.id,
      name: m.name,
      ownership: m.ownership,
      priceUnit: m.priceUnit,
      includesOperator: m.includesOperator,
      isFavorite: m.isFavorite,
      unitPrice: canSeeCosts ? m.unitPrice : null,
    })),
    hazards: hazards.map((h) => ({
      id: h.id,
      label: h.label,
      measures: parseMeasures(h.measuresJson),
      isFavorite: h.isFavorite,
    })),
    employees,
    laborRates: canSeeCosts
      ? {
          byCategory: Object.fromEntries(categoryRates.map((r) => [r.category, r.dailyUnitPrice])),
          byEmployee: Object.fromEntries(employeeRates.map((r) => [r.employeeId, r.dailyUnitPrice])),
        }
      : null,
    manDayBaseMinutes: settings.manDayBaseMinutes,
    canSeeCosts,
  };
}
