import ExcelJS from "exceljs";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export type AttendanceXlsxRow = {
  employeeName: string;
  targetDate: Date;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  breakMinutes: number;
  actualWorkMinutes: number | null;
  normalWorkMinutes: number | null;
  overtimeMinutes: number | null;
  nightShiftMinutes: number | null;
  holidayWorkMinutes: number | null;
  isPaidLeave: boolean;
  isAbsence: boolean;
  remarks: string | null;
};

function toHours(minutes: number | null): number | null {
  return minutes == null ? null : Math.round((minutes / 60) * 100) / 100;
}

function formatJstHm(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 勤怠表(REQUIREMENTS.md/依頼書のフェーズ8)。従業員ごとにまとめ、月間合計を付ける。 */
export async function buildAttendanceXlsx(params: {
  companyName: string;
  yearMonthLabel: string; // 例: "2026年09月"
  rows: AttendanceXlsxRow[];
}): Promise<Buffer<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("勤怠表", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 } });

  const headers = [
    "従業員名",
    "日付",
    "曜日",
    "出勤",
    "退勤",
    "休憩(分)",
    "実働(h)",
    "普通勤務(h)",
    "残業(h)",
    "深夜(h)",
    "休日勤務(h)",
    "有給",
    "欠勤",
    "備考",
  ];
  ws.addRow([`${params.companyName} 勤怠表 ${params.yearMonthLabel}`]);
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: "thin" } };
  });

  const byEmployee = new Map<string, AttendanceXlsxRow[]>();
  for (const row of params.rows) {
    const list = byEmployee.get(row.employeeName) ?? [];
    list.push(row);
    byEmployee.set(row.employeeName, list);
  }

  for (const [employeeName, rows] of byEmployee) {
    rows.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
    let totalActual = 0;
    let totalNormal = 0;
    let totalOvertime = 0;
    let totalNight = 0;
    let totalHoliday = 0;
    let paidLeaveCount = 0;
    let absenceCount = 0;

    for (const r of rows) {
      const jstDate = new Date(r.targetDate.getTime());
      ws.addRow([
        employeeName,
        `${jstDate.getUTCMonth() + 1}/${jstDate.getUTCDate()}`,
        WEEKDAY_JA[jstDate.getUTCDay()],
        formatJstHm(r.clockInTime),
        formatJstHm(r.clockOutTime),
        r.breakMinutes,
        toHours(r.actualWorkMinutes),
        toHours(r.normalWorkMinutes),
        toHours(r.overtimeMinutes),
        toHours(r.nightShiftMinutes),
        toHours(r.holidayWorkMinutes),
        r.isPaidLeave ? "○" : "",
        r.isAbsence ? "○" : "",
        r.remarks ?? "",
      ]);
      totalActual += r.actualWorkMinutes ?? 0;
      totalNormal += r.normalWorkMinutes ?? 0;
      totalOvertime += r.overtimeMinutes ?? 0;
      totalNight += r.nightShiftMinutes ?? 0;
      totalHoliday += r.holidayWorkMinutes ?? 0;
      if (r.isPaidLeave) paidLeaveCount += 1;
      if (r.isAbsence) absenceCount += 1;
    }

    const totalRow = ws.addRow([
      `${employeeName} 月間合計`,
      "",
      "",
      "",
      "",
      "",
      toHours(totalActual),
      toHours(totalNormal),
      toHours(totalOvertime),
      toHours(totalNight),
      toHours(totalHoliday),
      paidLeaveCount,
      absenceCount,
      "",
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" } };
    });
  }

  headers.forEach((_, i) => {
    ws.getColumn(i + 1).width = i === 0 ? 16 : i === headers.length - 1 ? 20 : 10;
  });

  const written = await wb.xlsx.writeBuffer();
  // exceljsが返すバッファはBuffer<ArrayBufferLike>型になるため、呼び出し側(Content-Length等)が
  // 要求するBuffer<ArrayBuffer>へ詰め直す(imageConversion.tsと同じ理由)。
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
