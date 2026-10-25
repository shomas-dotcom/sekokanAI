"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { ensureDailyReportMasters, MASTER_ORDER } from "@/lib/dailyReport/masters";
import { LABOR_CATEGORIES, normalizeName } from "@/lib/dailyReport/standardMasters";

// 日報かんたん入力のマスタ(作業内容・使用機械・労務単価・KY)の管理。管理者だけが使える。
// すべて自分の会社のデータだけを対象にする(companyIdで絞る)。
// 項目は「削除」ではなく「無効にする」で入力画面から外す(過去の日報の表示は変わらないため)。

type Tab = "work" | "machine" | "labor" | "ky";
const BASE_PATH = "/settings/daily-report-masters";

function back(tab: Tab, params: { error?: string; saved?: boolean } = {}): never {
  const query = new URLSearchParams({ tab });
  if (params.error) query.set("error", params.error);
  if (params.saved) query.set("saved", "1");
  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?${query.toString()}`);
}

function text(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

/** 空欄はnull、0以上の整数はその値、それ以外(マイナス・小数・文字)はundefined(不正)。 */
function priceOrNull(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) return undefined;
  return n;
}

async function audit(userId: string, companyId: string, action: string, targetType: string, targetId: string) {
  await logAction({ companyId, userId, action, targetType, targetId });
}

// --- 作業内容 ---

export async function saveWorkItemMasterAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData, "id", 50);
  const label = text(formData, "label", 100);
  if (!label) back("work", { error: "作業内容の名前を入力してください。" });
  const data = {
    label,
    defaultUnit: text(formData, "defaultUnit", 10) || null,
    isFavorite: formData.get("isFavorite") === "on",
    isActive: formData.get("isActive") === "on",
  };

  const all = await prisma.workItemMaster.findMany({ where: { companyId: admin.companyId }, select: { id: true, label: true } });
  if (all.some((w) => w.id !== id && normalizeName(w.label) === normalizeName(label))) {
    back("work", { error: `「${label}」はすでに登録されています。` });
  }

  if (id) {
    const result = await prisma.workItemMaster.updateMany({ where: { id, companyId: admin.companyId }, data });
    if (result.count === 0) back("work", { error: "作業内容が見つかりません。" });
    await audit(admin.id, admin.companyId, "dailyReportMaster.workItem.update", "WorkItemMaster", id);
  } else {
    const maxOrder = all.length > 0 ? (await prisma.workItemMaster.aggregate({ where: { companyId: admin.companyId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0 : 0;
    const created = await prisma.workItemMaster.create({
      data: { ...data, isActive: true, companyId: admin.companyId, sortOrder: maxOrder + 1 },
    });
    await audit(admin.id, admin.companyId, "dailyReportMaster.workItem.create", "WorkItemMaster", created.id);
  }
  back("work", { saved: true });
}

// --- 使用機械 ---

export async function saveMachineMasterAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData, "id", 50);
  const name = text(formData, "name", 100);
  if (!name) back("machine", { error: "機械の名前を入力してください。" });
  const unitPrice = priceOrNull(String(formData.get("unitPrice") ?? ""));
  if (unitPrice === undefined) back("machine", { error: "単価は0以上の整数(円)で入力してください。" });
  const ownership = formData.get("ownership") === "RENTAL" ? "RENTAL" : "OWN";
  const priceUnit = formData.get("priceUnit") === "HOUR" ? "HOUR" : "DAY";
  const data = {
    name,
    ownership,
    unitPrice,
    priceUnit,
    includesOperator: formData.get("includesOperator") === "on",
    isFavorite: formData.get("isFavorite") === "on",
    isActive: formData.get("isActive") === "on",
  } as const;

  const all = await prisma.machineMaster.findMany({ where: { companyId: admin.companyId }, select: { id: true, name: true } });
  if (all.some((m) => m.id !== id && normalizeName(m.name) === normalizeName(name))) {
    back("machine", { error: `「${name}」はすでに登録されています。` });
  }

  if (id) {
    const result = await prisma.machineMaster.updateMany({ where: { id, companyId: admin.companyId }, data });
    if (result.count === 0) back("machine", { error: "機械が見つかりません。" });
    await audit(admin.id, admin.companyId, "dailyReportMaster.machine.update", "MachineMaster", id);
  } else {
    const maxOrder = (await prisma.machineMaster.aggregate({ where: { companyId: admin.companyId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const created = await prisma.machineMaster.create({
      data: { ...data, isActive: true, companyId: admin.companyId, sortOrder: maxOrder + 1 },
    });
    await audit(admin.id, admin.companyId, "dailyReportMaster.machine.create", "MachineMaster", created.id);
  }
  back("machine", { saved: true });
}

// --- KY(危険と対策) ---

export async function saveHazardMasterAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = text(formData, "id", 50);
  const label = text(formData, "label", 100);
  if (!label) back("ky", { error: "危険の名前を入力してください。" });
  const measures = [
    ...new Set(
      String(formData.get("measures") ?? "")
        .split(/\r?\n/)
        .map((m) => m.trim().slice(0, 200))
        .filter(Boolean)
    ),
  ].slice(0, 20);
  const data = {
    label,
    measuresJson: JSON.stringify(measures),
    isFavorite: formData.get("isFavorite") === "on",
    isActive: formData.get("isActive") === "on",
  };

  const all = await prisma.kyHazardMaster.findMany({ where: { companyId: admin.companyId }, select: { id: true, label: true } });
  if (all.some((h) => h.id !== id && normalizeName(h.label) === normalizeName(label))) {
    back("ky", { error: `「${label}」はすでに登録されています。` });
  }

  if (id) {
    const result = await prisma.kyHazardMaster.updateMany({ where: { id, companyId: admin.companyId }, data });
    if (result.count === 0) back("ky", { error: "危険の項目が見つかりません。" });
    await audit(admin.id, admin.companyId, "dailyReportMaster.hazard.update", "KyHazardMaster", id);
  } else {
    const maxOrder = (await prisma.kyHazardMaster.aggregate({ where: { companyId: admin.companyId }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const created = await prisma.kyHazardMaster.create({
      data: { ...data, isActive: true, companyId: admin.companyId, sortOrder: maxOrder + 1 },
    });
    await audit(admin.id, admin.companyId, "dailyReportMaster.hazard.create", "KyHazardMaster", created.id);
  }
  back("ky", { saved: true });
}

// --- 並べ替え(1つ上・1つ下へ) ---

export async function moveMasterAction(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind") ?? "");
  const id = text(formData, "id", 50);
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const companyId = admin.companyId;
  const tab: Tab = kind === "machine" ? "machine" : kind === "hazard" ? "ky" : "work";

  // 画面と同じ並び(お気に入りが先頭)。お気に入りの境をまたいでは動かさない。
  const rows =
    kind === "machine"
      ? await prisma.machineMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER, select: { id: true, isFavorite: true } })
      : kind === "hazard"
        ? await prisma.kyHazardMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER, select: { id: true, isFavorite: true } })
        : await prisma.workItemMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER, select: { id: true, isFavorite: true } });

  const index = rows.findIndex((r) => r.id === id);
  const neighbor = rows[index + direction];
  if (index < 0 || !neighbor || neighbor.isFavorite !== rows[index].isFavorite) back(tab);

  const reordered = [...rows];
  [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
  const update = (rowId: string, sortOrder: number) =>
    kind === "machine"
      ? prisma.machineMaster.updateMany({ where: { id: rowId, companyId }, data: { sortOrder } })
      : kind === "hazard"
        ? prisma.kyHazardMaster.updateMany({ where: { id: rowId, companyId }, data: { sortOrder } })
        : prisma.workItemMaster.updateMany({ where: { id: rowId, companyId }, data: { sortOrder } });
  await prisma.$transaction(reordered.map((r, i) => update(r.id, i)));
  await audit(admin.id, companyId, "dailyReportMaster.move", kind, id);
  back(tab);
}

// --- 標準項目をもう一度入れる(消した・無効にした標準項目を戻したいとき) ---

export async function restoreStandardMastersAction() {
  const admin = await requireAdmin();
  // 入れた日時の記録を外して、足りない標準項目だけをもう一度入れる(登録済みの項目・単価は変えない)。
  await prisma.companyWorkSettings.updateMany({ where: { companyId: admin.companyId }, data: { dailyMastersSeededAt: null } });
  await ensureDailyReportMasters(admin.companyId);
  await audit(admin.id, admin.companyId, "dailyReportMaster.restoreStandard", "CompanyWorkSettings", admin.companyId);
  back("work", { saved: true });
}

// --- 労務単価・1人工の基準時間 ---

export async function saveLaborRatesAction(formData: FormData) {
  const admin = await requireAdmin();
  const companyId = admin.companyId;

  const hours = Number(String(formData.get("manDayHours") ?? "").trim());
  if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
    back("labor", { error: "1人工の基準時間は1〜24時間の間で入力してください。" });
  }

  // 先に全部の入力を検査する(途中で不正な値に気づいて一部だけ保存された状態にしないため)。
  const categoryPrices = LABOR_CATEGORIES.map((c) => ({ category: c, price: priceOrNull(String(formData.get(`cat_${c}`) ?? "")) }));
  const employees = await prisma.employee.findMany({ where: { companyId }, select: { id: true } });
  const employeePrices = employees.map((e) => ({ employeeId: e.id, price: priceOrNull(String(formData.get(`emp_${e.id}`) ?? "")) }));
  if ([...categoryPrices, ...employeePrices].some((p) => p.price === undefined)) {
    back("labor", { error: "単価は0以上の整数(円)で入力してください。何も保存していません。" });
  }

  await prisma.$transaction(async (tx) => {
    for (const { category, price } of categoryPrices) {
      if (price == null) {
        await tx.laborCategoryRate.deleteMany({ where: { companyId, category } });
      } else {
        await tx.laborCategoryRate.upsert({
          where: { companyId_category: { companyId, category } },
          update: { dailyUnitPrice: price },
          create: { companyId, category, dailyUnitPrice: price },
        });
      }
    }
    for (const { employeeId, price } of employeePrices) {
      if (price == null) {
        await tx.employeeLaborRate.deleteMany({ where: { companyId, employeeId } });
      } else {
        await tx.employeeLaborRate.upsert({
          where: { employeeId },
          update: { dailyUnitPrice: price },
          create: { companyId, employeeId, dailyUnitPrice: price },
        });
      }
    }
  });

  const settings = await getOrCreateWorkSettings(companyId);
  await prisma.companyWorkSettings.update({
    where: { id: settings.id },
    data: { manDayBaseMinutes: Math.round(hours * 60) },
  });
  await audit(admin.id, companyId, "dailyReportMaster.laborRates.update", "CompanyWorkSettings", settings.id);
  back("labor", { saved: true });
}
