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

  // 当日早朝分(0〜nightEnd)も数える。これがないと4時〜8時勤務の深夜時間が0になる。
  const earlyMorningNight = overlap(start, end, 0, nightEnd);
  const todayNight = overlap(start, end, nightStart, 1440);
  const tomorrowNight = overlap(start, end, 1440, 1440 + nightEnd);
  return earlyMorningNight + todayNight + tomorrowNight;
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
  // 休憩は0以上の整数のみ。負の休憩で実働が増える・小数で端数が出ることを防ぐ。
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return null;
  const start = parseWallTimeMinutes(startTime);
  const end = parseWallTimeMinutes(endTime);
  if (start == null || end == null) return null;
  const minutes = end - start - breakMinutes;
  return minutes > 0 ? minutes : null;
}

/** "HH:mm"を0時からの分数にする。時は0〜29(深夜の翌日跨ぎ表記)、分は0〜59以外は不正としてnull。 */
export function parseWallTimeMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 29 || minute > 59) return null;
  return hour * 60 + minute;
}

export type WorkInterval = {
  start: Date | null;
  end: Date | null;
  breakMinutes: number;
  workMinutes: number | null;
};

/**
 * 同じ人・同じ日の複数の作業区間(複数現場の日報)を、勤怠1日分にまとめる。
 * 出勤は最も早い開始、退勤は最も遅い終了、休憩・実働は合計。
 * 区間が重なっている場合は二重計上のおそれがあるため overlaps=true を返す(呼び出し側で自動確定しない)。
 * 時刻がない区間がある場合も、合計が正しいか判断できないため incomplete=true を返す。
 */
export function mergeWorkIntervals(intervals: WorkInterval[]): {
  clockIn: Date | null;
  clockOut: Date | null;
  breakMinutes: number;
  workMinutes: number | null;
  overlaps: boolean;
  incomplete: boolean;
} {
  const timed = intervals.filter((i) => i.start && i.end) as (WorkInterval & { start: Date; end: Date })[];
  const incomplete = timed.length !== intervals.length || intervals.some((i) => i.workMinutes == null);

  const sorted = [...timed].sort((a, b) => a.start.getTime() - b.start.getTime());
  let overlaps = false;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start.getTime() < sorted[i - 1].end.getTime()) overlaps = true;
  }

  const clockIn = sorted.length ? sorted[0].start : null;
  const clockOut = sorted.length ? new Date(Math.max(...sorted.map((i) => i.end.getTime()))) : null;
  const breakMinutes = intervals.reduce((sum, i) => sum + (i.breakMinutes ?? 0), 0);
  const known = intervals.filter((i) => i.workMinutes != null);
  const workMinutes = known.length ? known.reduce((sum, i) => sum + (i.workMinutes ?? 0), 0) : null;

  return { clockIn, clockOut, breakMinutes, workMinutes, overlaps, incomplete };
}
