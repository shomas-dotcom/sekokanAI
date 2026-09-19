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

function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 日本時間の壁時計時刻(分, 0〜1439)を、出勤時刻を基準とした連続した分数へ変換する
 * (退勤が出勤より前=日をまたいだとみなし、+1440する)。
 */
function jstMinutesOfDay(date: Date): number {
  const hhmm = formatJstTime(date); // "HH:mm"
  return hhmmToMinutes(hhmm) ?? 0;
}

/**
 * 出勤〜退勤のうち、深夜帯(既定22:00〜翌5:00)に重なる分数を計算する。
 * 会社設定のnightShiftStartTime/nightShiftEndTimeを日をまたぐ区間として扱う。
 */
export function computeNightShiftMinutes(
  clockInTime: Date | null,
  clockOutTime: Date | null,
  nightShiftStartTime: string,
  nightShiftEndTime: string
): number | null {
  if (!clockInTime || !clockOutTime) return null;
  const start = jstMinutesOfDay(clockInTime);
  let end = jstMinutesOfDay(clockOutTime);
  if (end <= start) end += 1440; // 日をまたぐ勤務

  const nightStart = hhmmToMinutes(nightShiftStartTime) ?? 22 * 60;
  const nightEnd = hhmmToMinutes(nightShiftEndTime) ?? 5 * 60;

  // 深夜帯(当日分: nightStart〜1440、翌日分: 1440+0〜1440+nightEnd)との重なりを合計する
  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

  const todayNight = overlap(start, end, nightStart, 1440);
  const tomorrowNight = overlap(start, end, 1440, 1440 + nightEnd);
  return todayNight + tomorrowNight;
}

/** 会社設定に基づき、実働時間を普通勤務・残業・休日勤務に振り分ける。 */
export function computeAttendanceBreakdown(params: {
  actualWorkMinutes: number | null;
  workCategory: string;
  scheduledWorkMinutes: number;
}): { normalWorkMinutes: number | null; overtimeMinutes: number | null; holidayWorkMinutes: number | null } {
  const { actualWorkMinutes, workCategory, scheduledWorkMinutes } = params;
  if (actualWorkMinutes == null) return { normalWorkMinutes: null, overtimeMinutes: null, holidayWorkMinutes: null };

  if (workCategory === "HOLIDAY_WORK") {
    return { normalWorkMinutes: 0, overtimeMinutes: 0, holidayWorkMinutes: actualWorkMinutes };
  }
  const normalWorkMinutes = Math.min(actualWorkMinutes, scheduledWorkMinutes);
  const overtimeMinutes = Math.max(0, actualWorkMinutes - scheduledWorkMinutes);
  return { normalWorkMinutes, overtimeMinutes, holidayWorkMinutes: 0 };
}

/** "HH:mm"の開始・終了と休憩分数から実働分数を計算する。不正な入力・逆転はnullを返す。 */
export function computeWorkMinutes(
  startTime: string | null,
  endTime: string | null,
  breakMinutes: number
): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const minutes = eh * 60 + em - (sh * 60 + sm) - breakMinutes;
  return minutes > 0 ? minutes : null;
}
