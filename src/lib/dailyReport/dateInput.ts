/** 日付の入力欄("YYYY-MM-DD")を、日報の保存と同じ形(その日のUTC 0時)に変える。形式が違えばnull。 */
export function parseReportDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}
