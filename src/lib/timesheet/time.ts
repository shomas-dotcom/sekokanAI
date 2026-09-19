// 勤怠・出面の時刻はすべて「日本時間(Asia/Tokyo)の壁時計時刻」として入力・表示する。
// 本番サーバー(Render)はUTCで動くため、new Date(year, month, day, hour, minute)を
// そのまま使うと9時間ずれる。日本は夏時間(DST)がないため、常にUTC+9固定で変換できる。

/** "HH:mm"文字列とその日の日付から、対応するUTC上のDateを作る(日本時間の壁時計時刻として解釈)。 */
export function jstWallTimeToUtc(dateOnly: Date, hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 29 || minute > 59) return null; // 29時表記(深夜帯の翌日跨ぎ表記)まで許容
  return new Date(
    Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), hour - 9, minute)
  );
}

/** DateTimeを日本時間の"HH:mm"表示に変換する。 */
export function formatJstTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** DateTimeを日本時間の"YYYY/MM/DD HH:mm"表示に変換する。 */
export function formatJstDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 日本時間基準で「その日の0時」を表すUTC上のDateを作る(targetDateの保存・比較に使う)。 */
export function jstStartOfDay(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day - 0, -9, 0));
}
