// 日報かんたん入力(4タブ)で扱う入力内容の型・検査・要約文づくり・重複防止。
// 画面(クライアント)と保存処理(サーバー)の両方から使う純粋な関数だけを置く(DBには触れない)。
//
// 画面から届いた内容はそのまま信用せず、保存の前に必ずここで検査する
// (数字の範囲・文字数・件数・重複)。金額は画面から受け取らず、サーバー側でマスタの単価から計算する。

import type { LaborCategory, MachineOwnership } from "@/generated/prisma/enums";
import { LABOR_CATEGORIES, normalizeName } from "./standardMasters";

export type QuickWork = {
  key: string;
  workItemId: string | null;
  label: string;
  quantity: number | null;
  unit: string | null;
  workMinutes: number | null;
  remarks: string | null;
};

export type QuickMachine = {
  key: string;
  /** すでに保存されている明細のID(直して保存し直すときに、同じ明細として更新するため) */
  id: string | null;
  machineId: string | null;
  name: string;
  ownership: MachineOwnership;
  quantity: number;
  /** 使用日数または使用時間(その機械の単価の単位に従う) */
  usageValue: number;
};

export type QuickLabor = {
  key: string;
  id: string | null;
  category: LaborCategory | null;
  employeeId: string | null;
  workerName: string;
  affiliation: string | null;
  headcount: number;
  /** 1人あたりの人工数 */
  manDays: number;
  workMinutes: number | null;
};

export type QuickKy = {
  key: string;
  hazardId: string | null;
  label: string;
  measures: string[];
};

export type QuickState = {
  works: QuickWork[];
  machines: QuickMachine[];
  labor: QuickLabor[];
  ky: QuickKy[];
};

export const EMPTY_QUICK_STATE: QuickState = { works: [], machines: [], labor: [], ky: [] };

export const QUICK_LIMITS = {
  works: 50,
  machines: 50,
  labor: 50,
  ky: 30,
  measuresPerKy: 20,
  textLength: 200,
  maxQuantity: 1_000_000,
  maxMachineCount: 100,
  maxUsageValue: 1000,
  maxHeadcount: 99,
  maxManDays: 10,
  maxWorkMinutes: 24 * 60,
} as const;

export type ParseResult = { ok: true; state: QuickState } | { ok: false; error: string };

class InvalidInput extends Error {}

function str(value: unknown, field: string, { required = false } = {}): string {
  if (value == null) {
    if (required) throw new InvalidInput(`${field}が入力されていません。`);
    return "";
  }
  if (typeof value !== "string") throw new InvalidInput(`${field}の形式が正しくありません。`);
  const text = value.trim();
  if (required && !text) throw new InvalidInput(`${field}が入力されていません。`);
  if (text.length > QUICK_LIMITS.textLength) {
    throw new InvalidInput(`${field}は${QUICK_LIMITS.textLength}文字以内で入力してください。`);
  }
  return text;
}

function optionalStr(value: unknown, field: string): string | null {
  return str(value, field) || null;
}

function num(
  value: unknown,
  field: string,
  { min = 0, max, integer = false, nullable = false }: { min?: number; max: number; integer?: boolean; nullable?: boolean }
): number | null {
  if (value == null || value === "") {
    if (nullable) return null;
    throw new InvalidInput(`${field}が入力されていません。`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new InvalidInput(`${field}は数字で入力してください。`);
  if (n < min || n > max) throw new InvalidInput(`${field}は${min}から${max}の間で入力してください。`);
  if (integer && !Number.isInteger(n)) throw new InvalidInput(`${field}は整数で入力してください。`);
  return Math.round(n * 100) / 100;
}

function list(value: unknown, field: string, max: number): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new InvalidInput(`${field}の形式が正しくありません。`);
  if (value.length > max) throw new InvalidInput(`${field}は${max}件までです。`);
  return value;
}

function obj(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidInput(`${field}の形式が正しくありません。`);
  }
  return value as Record<string, unknown>;
}

const OWNERSHIPS: MachineOwnership[] = ["OWN", "RENTAL"];

/**
 * 画面から届いたJSON文字列を検査して、入力内容(QuickState)に直す。
 * 不正な値は黙って直さず、利用者に分かる日本語のエラーにする。
 * 同じ作業・同じ機械・同じ従業員の重複は、ここで1件にまとめる。
 */
export function parseQuickPayload(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "{}");
  } catch {
    return { ok: false, error: "入力内容を読み取れませんでした。画面を開き直してもう一度お試しください。" };
  }
  try {
    const root = obj(raw, "入力内容");

    const works = list(root.works, "作業内容", QUICK_LIMITS.works).map((item, i) => {
      const o = obj(item, `作業内容${i + 1}`);
      return {
        key: str(o.key, "作業内容の識別子") || `w${i}`,
        workItemId: optionalStr(o.workItemId, "作業内容マスタ"),
        label: str(o.label, "作業内容", { required: true }),
        quantity: num(o.quantity, "施工数量", { max: QUICK_LIMITS.maxQuantity, nullable: true }),
        unit: optionalStr(o.unit, "単位"),
        workMinutes: num(o.workMinutes, "作業時間", { max: QUICK_LIMITS.maxWorkMinutes, integer: true, nullable: true }),
        remarks: optionalStr(o.remarks, "作業内容の備考"),
      } satisfies QuickWork;
    });

    const machines = list(root.machines, "使用機械", QUICK_LIMITS.machines).map((item, i) => {
      const o = obj(item, `使用機械${i + 1}`);
      const ownership = typeof o.ownership === "string" ? (o.ownership as MachineOwnership) : "OWN";
      if (!OWNERSHIPS.includes(ownership)) throw new InvalidInput("自社所有/レンタルの区分が正しくありません。");
      return {
        key: str(o.key, "機械の識別子") || `m${i}`,
        id: optionalStr(o.id, "機械明細"),
        machineId: optionalStr(o.machineId, "機械マスタ"),
        name: str(o.name, "機械名", { required: true }),
        ownership,
        quantity: num(o.quantity, "使用台数", { min: 0.01, max: QUICK_LIMITS.maxMachineCount }) ?? 1,
        usageValue: num(o.usageValue, "使用日数・時間", { min: 0.01, max: QUICK_LIMITS.maxUsageValue }) ?? 1,
      } satisfies QuickMachine;
    });

    const labor = list(root.labor, "労務", QUICK_LIMITS.labor).map((item, i) => {
      const o = obj(item, `労務${i + 1}`);
      const category = o.category == null || o.category === "" ? null : (o.category as LaborCategory);
      if (category !== null && !LABOR_CATEGORIES.includes(category)) throw new InvalidInput("労務の区分が正しくありません。");
      const employeeId = optionalStr(o.employeeId, "従業員");
      const headcount = num(o.headcount ?? 1, "人数", { min: 1, max: QUICK_LIMITS.maxHeadcount, integer: true }) ?? 1;
      // 従業員を指定した行は1名分。人数のまとめ入力は、従業員を指定しない外注・応援等だけに使う。
      if (employeeId && headcount !== 1) throw new InvalidInput("従業員を選んだ行の人数は1名にしてください。");
      return {
        key: str(o.key, "労務の識別子") || `l${i}`,
        id: optionalStr(o.id, "労務明細"),
        category,
        employeeId,
        workerName: str(o.workerName, "作業員名"),
        affiliation: optionalStr(o.affiliation, "所属会社"),
        headcount,
        manDays: num(o.manDays, "人工数", { min: 0.01, max: QUICK_LIMITS.maxManDays }) ?? 1,
        workMinutes: num(o.workMinutes, "作業時間", { max: QUICK_LIMITS.maxWorkMinutes, integer: true, nullable: true }),
      } satisfies QuickLabor;
    });

    const ky = list(root.ky, "KY(危険予知)", QUICK_LIMITS.ky).map((item, i) => {
      const o = obj(item, `KY${i + 1}`);
      const measures = list(o.measures, "KYの対策", QUICK_LIMITS.measuresPerKy)
        .map((m) => str(m, "KYの対策"))
        .filter((m) => m.length > 0);
      return {
        key: str(o.key, "KYの識別子") || `k${i}`,
        hazardId: optionalStr(o.hazardId, "KYマスタ"),
        label: str(o.label, "危険の内容", { required: true }),
        measures: [...new Set(measures)],
      } satisfies QuickKy;
    });

    return { ok: true, state: dedupeQuickState({ works, machines, labor, ky }) };
  } catch (err) {
    if (err instanceof InvalidInput) return { ok: false, error: err.message };
    throw err;
  }
}

// --- 重複の整理 ---

/** 同じ作業・同じ機械・同じ従業員・同じ危険を1件にまとめる(先に入力したものを残し、空欄だけ後のもので補う)。 */
export function dedupeQuickState(state: QuickState): QuickState {
  const works: QuickWork[] = [];
  for (const w of state.works) {
    const same = works.find((x) => normalizeName(x.label) === normalizeName(w.label));
    if (!same) {
      works.push({ ...w });
      continue;
    }
    same.quantity ??= w.quantity;
    same.unit ??= w.unit;
    same.workMinutes ??= w.workMinutes;
    same.remarks ??= w.remarks;
    same.workItemId ??= w.workItemId;
  }

  const machines: QuickMachine[] = [];
  for (const m of state.machines) {
    const same = machines.find((x) => normalizeName(x.name) === normalizeName(m.name) && x.ownership === m.ownership);
    if (!same) {
      machines.push({ ...m });
      continue;
    }
    // 台数・使用日数は足し算しない(同じ機械を2回入力しても2台にならない)。大きいほうを採用する。
    same.quantity = Math.max(same.quantity, m.quantity);
    same.usageValue = Math.max(same.usageValue, m.usageValue);
    same.id ??= m.id;
    same.machineId ??= m.machineId;
  }

  const labor: QuickLabor[] = [];
  for (const l of state.labor) {
    const same = l.employeeId ? labor.find((x) => x.employeeId === l.employeeId) : null;
    if (same) {
      same.id ??= l.id;
      continue;
    }
    labor.push({ ...l });
  }

  const ky: QuickKy[] = [];
  for (const k of state.ky) {
    const same = ky.find((x) => normalizeName(x.label) === normalizeName(k.label));
    if (!same) {
      ky.push({ ...k, measures: [...k.measures] });
      continue;
    }
    same.measures = [...new Set([...same.measures, ...k.measures])];
    same.hazardId ??= k.hazardId;
  }

  return { works, machines, labor, ky };
}

// --- 労務の集計 ---

/** 人数の合計。 */
export function totalHeadcount(labor: QuickLabor[]): number {
  return labor.reduce((sum, l) => sum + l.headcount, 0);
}

/** 人工数の合計(人数 × 1人あたりの人工数)。 */
export function totalManDays(labor: QuickLabor[]): number {
  return Math.round(labor.reduce((sum, l) => sum + l.headcount * l.manDays, 0) * 100) / 100;
}

/** 運転手込みの機械があるのに、重機オペレーターの人工も入っている(二重に数えるおそれがある)か。 */
export function hasOperatorDoubleCount(
  machines: { includesOperator: boolean }[],
  labor: { category: LaborCategory | null }[]
): boolean {
  return machines.some((m) => m.includesOperator) && labor.some((l) => l.category === "OPERATOR");
}

// --- 機械の金額 ---

/** 機械の使用金額 = 台数 × 使用日数(時間) × 単価。単価が未登録(null)なら金額は出さない(0円にしない)。 */
export function machineAmount(quantity: number, usageValue: number, unitPrice: number | null): number | null {
  if (unitPrice == null) return null;
  return Math.round(quantity * usageValue * unitPrice);
}

/** 労務費 = 人数 × 1人あたりの人工数 × 単価(1人工あたり)。単価が未登録なら金額は出さない。 */
export function laborAmount(headcount: number, manDaysEach: number, unitPrice: number | null): number | null {
  if (unitPrice == null) return null;
  return Math.round(headcount * manDaysEach * unitPrice);
}

// --- 既存の文章欄に書き込む要約(PDF・Excel・既存画面をそのまま使い続けるため) ---

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function summarizeWorks(works: QuickWork[]): string {
  return works
    .map((w) => {
      let text = w.label;
      if (w.quantity != null) text += ` ${fmt(w.quantity)}${w.unit ?? ""}`;
      if (w.workMinutes != null) text += `(${fmt(w.workMinutes / 60)}時間)`;
      if (w.remarks) text += ` ${w.remarks}`;
      return text;
    })
    .join("、");
}

/** 「出来高・数量」欄用。数量を入れた作業だけを並べる。 */
export function summarizeQuantities(works: QuickWork[]): string {
  return works
    .filter((w) => w.quantity != null)
    .map((w) => `${w.label} ${fmt(w.quantity as number)}${w.unit ?? ""}`)
    .join("、");
}

// 車両として「使用車両」欄に分ける機械(それ以外は「使用機械」欄)。
const VEHICLE_NAME_PATTERN = /ダンプ|キャブ|バン|トラック|乗用|ワゴン/;

export function isVehicleName(name: string): boolean {
  return VEHICLE_NAME_PATTERN.test(name);
}

function machineText(m: { name: string; quantity: number; ownership: MachineOwnership }): string {
  return `${m.name} ${fmt(m.quantity)}台${m.ownership === "RENTAL" ? "(レンタル)" : ""}`;
}

export function summarizeMachinery(machines: QuickMachine[]): string {
  return machines.filter((m) => !isVehicleName(m.name)).map(machineText).join("、");
}

export function summarizeVehicles(machines: QuickMachine[]): string {
  return machines.filter((m) => isVehicleName(m.name)).map(machineText).join("、");
}

export function summarizeKy(ky: QuickKy[]): string {
  return ky.map((k) => (k.measures.length > 0 ? `${k.label}(対策: ${k.measures.join("、")})` : k.label)).join("\n");
}

// --- 音声などから取り出した内容を、タップで選んだ内容へ重ねる ---

export type QuickExtraction = {
  works: { workItemId: string | null; label: string; quantity: number | null; unit: string | null }[];
  machines: { machineId: string | null; name: string; quantity: number }[];
  /** 全体の作業員数(「作業員3名」)。区分・氏名までは分からない。 */
  workerCount: number | null;
  /** 全体の人工数(「3人工」)。 */
  manDaysTotal: number | null;
  hazards: { hazardId: string | null; label: string; measures: string[] }[];
  nextDayPlan: string | null;
  /** 読み取れなかった・確認が必要な項目(画面に出して人が直す)。 */
  unclear: string[];
};

export type MergeResult = {
  state: QuickState;
  /** 画面に出す「今回追加したもの」の一覧。 */
  added: string[];
  /** すでに入っていたため追加しなかったもの。 */
  skipped: string[];
};

/**
 * 音声から取り出した内容を、すでに選んである内容へ重ねる。
 * - 同じ作業・機械・危険はもう一度入れない(すでにあるものの空欄だけ補う)。
 * - 作業員数は「全体の人数」なので、すでに入っている人数の合計を超えた分だけ、区分未選択の行として足す。
 *   (氏名つきで入れた人と、音声の人数を二重に数えないため)
 */
export function mergeExtraction(
  current: QuickState,
  extraction: QuickExtraction,
  makeKey: () => string
): MergeResult {
  const added: string[] = [];
  const skipped: string[] = [];
  const state: QuickState = {
    works: current.works.map((w) => ({ ...w })),
    machines: current.machines.map((m) => ({ ...m })),
    labor: current.labor.map((l) => ({ ...l })),
    ky: current.ky.map((k) => ({ ...k, measures: [...k.measures] })),
  };

  for (const w of extraction.works) {
    const same = state.works.find((x) => normalizeName(x.label) === normalizeName(w.label));
    if (same) {
      same.quantity ??= w.quantity;
      same.unit ??= w.unit;
      skipped.push(`作業「${w.label}」`);
      continue;
    }
    state.works.push({
      key: makeKey(),
      workItemId: w.workItemId,
      label: w.label,
      quantity: w.quantity,
      unit: w.unit,
      workMinutes: null,
      remarks: null,
    });
    added.push(`作業「${w.label}」`);
  }

  for (const m of extraction.machines) {
    const same = state.machines.find((x) => normalizeName(x.name) === normalizeName(m.name));
    if (same) {
      skipped.push(`機械「${m.name}」`);
      continue;
    }
    state.machines.push({
      key: makeKey(),
      id: null,
      machineId: m.machineId,
      name: m.name,
      ownership: "OWN",
      quantity: m.quantity,
      usageValue: 1,
    });
    added.push(`機械「${m.name}」${fmt(m.quantity)}台`);
  }

  if (extraction.workerCount != null && extraction.workerCount > 0) {
    const existing = totalHeadcount(state.labor);
    const missing = extraction.workerCount - existing;
    if (missing > 0) {
      const perPerson =
        extraction.manDaysTotal != null && extraction.workerCount > 0
          ? Math.min(QUICK_LIMITS.maxManDays, Math.max(0.25, Math.round((extraction.manDaysTotal / extraction.workerCount) * 4) / 4))
          : 1;
      state.labor.push({
        key: makeKey(),
        id: null,
        category: null,
        employeeId: null,
        workerName: "",
        affiliation: null,
        headcount: Math.min(missing, QUICK_LIMITS.maxHeadcount),
        manDays: perPerson,
        workMinutes: null,
      });
      added.push(`作業員${missing}名(区分と人工数を確認してください)`);
    } else {
      skipped.push(`作業員${extraction.workerCount}名`);
    }
  }

  for (const h of extraction.hazards) {
    const same = state.ky.find((x) => normalizeName(x.label) === normalizeName(h.label));
    if (same) {
      skipped.push(`危険「${h.label}」`);
      continue;
    }
    // 対策は自動では選ばない(AIや辞書の提案を確定させない)。危険の内容だけを入れ、対策は人が選ぶ。
    state.ky.push({ key: makeKey(), hazardId: h.hazardId, label: h.label, measures: [] });
    added.push(`危険「${h.label}」(対策は選んでください)`);
  }

  return { state: dedupeQuickState(state), added, skipped };
}
