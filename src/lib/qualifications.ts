// 保有資格の期限判定。何日前から警告するかをここで一元管理する
// (画面(一覧・ダッシュボード)ごとに閾値がバラバラにならないようにするため)。
export const QUALIFICATION_WARNING_DAYS = 90;

function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

export function isExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return daysUntil(expiresAt, now) < 0;
}

export function isExpiringSoon(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const days = daysUntil(expiresAt, now);
  return days >= 0 && days <= QUALIFICATION_WARNING_DAYS;
}
