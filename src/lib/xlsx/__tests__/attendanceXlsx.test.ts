import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildAttendanceXlsx } from "@/lib/xlsx/attendanceXlsx";
import { buildSiteAttendanceXlsx } from "@/lib/xlsx/siteAttendanceXlsx";

describe("buildAttendanceXlsx", () => {
  it("従業員ごとの明細と月間合計行を出力する", async () => {
    const buffer = await buildAttendanceXlsx({
      companyName: "杉本土木株式会社",
      yearMonthLabel: "2026年09月",
      rows: [
        {
          employeeName: "杉本将真",
          targetDate: new Date(Date.UTC(2026, 8, 1)),
          clockInTime: null,
          clockOutTime: null,
          breakMinutes: 60,
          actualWorkMinutes: 480,
          normalWorkMinutes: 480,
          overtimeMinutes: 0,
          nightShiftMinutes: 0,
          holidayWorkMinutes: 0,
          isPaidLeave: false,
          isAbsence: false,
          remarks: null,
        },
        {
          employeeName: "杉本将真",
          targetDate: new Date(Date.UTC(2026, 8, 2)),
          clockInTime: null,
          clockOutTime: null,
          breakMinutes: 60,
          actualWorkMinutes: 540,
          normalWorkMinutes: 480,
          overtimeMinutes: 60,
          nightShiftMinutes: 0,
          holidayWorkMinutes: 0,
          isPaidLeave: false,
          isAbsence: false,
          remarks: null,
        },
      ],
    });

    const wb = new ExcelJS.Workbook();
    // Buffer<ArrayBuffer>とexceljsの型定義上のBufferがTSのlibバージョン差で噛み合わないだけで、
    // 実行時は問題ない(テストのみの回避)。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet("勤怠表");
    expect(ws).toBeDefined();

    const values: string[] = [];
    ws!.eachRow((row) => values.push(row.getCell(1).value?.toString() ?? ""));
    expect(values).toContain("杉本将真");
    expect(values.some((v) => v.includes("月間合計"))).toBe(true);
  });
});

describe("buildSiteAttendanceXlsx", () => {
  it("人工金額・車両経費・月間合計を出力する", async () => {
    const buffer = await buildSiteAttendanceXlsx({
      companyName: "杉本土木株式会社",
      periodLabel: "2026年09月",
      laborRows: [
        {
          primeContractorName: "日本道路株式会社",
          projectName: "坂戸市道舗装工事",
          targetDate: new Date(Date.UTC(2026, 8, 1)),
          workerName: "杉本将真",
          jobType: "土工",
          workContent: "As舗装工",
          manDays: 1,
          manDayUnitPrice: 20000,
        },
      ],
      expenseRows: [
        {
          projectName: "坂戸市道舗装工事",
          targetDate: new Date(Date.UTC(2026, 8, 1)),
          category: "重機",
          name: "バックホウ",
          quantity: 1,
          unitPrice: 15000,
          amount: 15000,
        },
      ],
    });

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet("出面集計表");
    expect(ws).toBeDefined();

    const values: string[] = [];
    ws!.eachRow((row) => row.eachCell((cell) => values.push(cell.value?.toString() ?? "")));
    expect(values).toContain("日本道路株式会社");
    expect(values).toContain("バックホウ");
    expect(values.some((v) => v.includes("月間合計"))).toBe(true);
  });
});
