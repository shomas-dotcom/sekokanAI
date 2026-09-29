import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isPremium } from "@/lib/premium";

// 公開前修正①「30社限定・登録から6か月無料」(モニター募集)。
// 既存の有料契約(Company.plan / subscriptionStatus)とは別の、独立した利用権として管理する
// (Stripeの契約状態を偽装しない。ALLOW_MOCK_BILLINGでは代用しない)。

// 受付開始日時の既定値: 日本時間2026年10月1日 00:00 = UTC 2026-09-30T15:00:00.000Z
const DEFAULT_STARTS_AT = new Date("2026-09-30T15:00:00.000Z");

type Db = Prisma.TransactionClient | typeof prisma;

/** モニター募集の設定(常に1行だけ)。無ければ既定値(無効・30社・6か月)で作る。 */
export async function getOrCreateMonitorProgram(db: Db = prisma) {
  const existing = await db.monitorProgram.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.monitorProgram.create({
    data: { id: "singleton", enabled: false, capacity: 30, startsAt: DEFAULT_STARTS_AT, freeMonths: 6 },
  });
}

/**
 * UTCのDateを、日本時間での暦月をmonths分進めた瞬間(同じ時刻)のUTC Dateにする。
 * 月末は繰り上げず、その月の末日に丸める(例: JSTで1/31 + 1か月 → 2/28または2/29)。
 */
export function addCalendarMonthsJst(date: Date, months: number): Date {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const targetFirst = new Date(Date.UTC(y, m + months, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonth = targetFirst.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(jst.getUTCDate(), daysInTargetMonth);
  const resultJst = new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      jst.getUTCHours(),
      jst.getUTCMinutes(),
      jst.getUTCSeconds(),
      jst.getUTCMilliseconds()
    )
  );
  return new Date(resultJst.getTime() - JST_OFFSET_MS);
}

export type MonitorCompany = {
  isMonitor: boolean;
  monitorEnrolledAt: Date | null;
  monitorFreeMonths: number | null;
};

/** モニターの無料期間の終了日時(モニターでない/起算日が無い場合はnull)。 */
export function monitorFreeUntil(company: MonitorCompany): Date | null {
  if (!company.isMonitor || !company.monitorEnrolledAt) return null;
  return addCalendarMonthsJst(company.monitorEnrolledAt, company.monitorFreeMonths ?? 6);
}

/** 今、モニターの無料期間中かどうか。 */
export function isMonitorPeriodActive(company: MonitorCompany, now: Date = new Date()): boolean {
  const until = monitorFreeUntil(company);
  return until != null && now < until;
}

/**
 * 見積の新規作成・AI下書きを使えるか。既存の有料契約(isPremium)に加え、モニターの無料期間中も
 * 使える(依頼「モニター期間中は...見積を利用できるようにする」)。他の機能(施工計画書等)は
 * これまで通りisPremiumのみで判定し、今回新たに開放しない。
 */
export function canCreateQuotes(company: { plan: string } & MonitorCompany): boolean {
  return isPremium(company) || isMonitorPeriodActive(company);
}

export type MonitorSignupStatus =
  | { status: "open"; remaining: number; capacity: number }
  | { status: "not_started"; startsAt: Date }
  | { status: "disabled" }
  | { status: "full"; capacity: number };

/** 登録画面での案内表示用。実際の可否の最終確認はtryEnrollMonitor(トランザクション内)で行う。 */
export async function getMonitorSignupStatus(db: Db = prisma, now: Date = new Date()): Promise<MonitorSignupStatus> {
  const program = await getOrCreateMonitorProgram(db);
  if (now < program.startsAt) return { status: "not_started", startsAt: program.startsAt };
  if (!program.enabled) return { status: "disabled" };
  const used = await db.company.count({ where: { isMonitor: true } });
  if (used >= program.capacity) return { status: "full", capacity: program.capacity };
  return { status: "open", remaining: program.capacity - used, capacity: program.capacity };
}

export const MONITOR_STATUS_MESSAGE: Record<string, (s: MonitorSignupStatus) => string> = {
  not_started: (s) =>
    s.status === "not_started"
      ? `モニター受付は${s.startsAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" })}から開始します。もうしばらくお待ちください。`
      : "",
  disabled: () => "現在、新規のモニター受付を停止しています。",
  full: (s) =>
    s.status === "full" ? `モニター枠(${s.capacity}社)が満員になりました。新規のお申し込みは受け付けておりません。` : "",
};

/**
 * モニター登録を1件確保する(会社作成と同じトランザクション内で呼ぶこと)。同時に登録が
 * 集中しても枠(capacity)を超えないよう、アドバイザリーロックで直列化してから数える
 * (src/lib/aiUsageLog.tsのreserveAiRunと同じ考え方)。失敗時は何も変更しない(枠を消費しない)。
 */
export async function tryEnrollMonitor(
  tx: Prisma.TransactionClient,
  now: Date = new Date()
): Promise<{ ok: true; enrolledAt: Date; freeMonths: number } | { ok: false; status: MonitorSignupStatus }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('genba-ai:monitor-signup'))`;
  const status = await getMonitorSignupStatus(tx, now);
  if (status.status !== "open") return { ok: false, status };
  const program = await getOrCreateMonitorProgram(tx);
  return { ok: true, enrolledAt: now, freeMonths: program.freeMonths };
}
