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
          isBillable: true,
          isCostTarget: true,
          manDayUnitPrice: 20000,
          laborCostUnitPrice: 15000,
        },
        {
          primeContractorName: "日本道路株式会社",
          projectName: "坂戸市道舗装工事",
          targetDate: new Date(Date.UTC(2026, 8, 2)),
          workerName: "田中",
          jobType: "土工",
          workContent: "As舗装工",
          manDays: 1,
          isBillable: true,
          isCostTarget: true,
          manDayUnitPrice: 20000,
          laborCostUnitPrice: null,
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
    // 請求と原価を別の列に出し、原価未入力は0円で埋めず件数を書く(F10)
    expect(values).toContain("請求単価");
    expect(values).toContain("原価単価");
    expect(values).toContain("40000"); // 請求合計 20,000×2
    expect(values).toContain("15000"); // 原価合計(未入力の1件は含めない)
    expect(values).toContain("単価未入力があるため計算しません");
    expect(values.some((v) => v.includes("原価 1件"))).toBe(true);
  });

  it("原価だけの経費(日報かんたん入力の機械費)は、請求の月間合計に足さない", async () => {
    const buffer = await buildSiteAttendanceXlsx({
      companyName: "杉本土木株式会社",
      periodLabel: "2026年10月",
      laborRows: [
        {
          primeContractorName: null,
          projectName: "現場",
          targetDate: new Date(Date.UTC(2026, 9, 1)),
          workerName: "田中",
          jobType: null,
          workContent: null,
          manDays: 1,
          isBillable: true,
          isCostTarget: true,
          manDayUnitPrice: 20000,
          laborCostUnitPrice: 15000,
        },
      ],
      expenseRows: [
        { projectName: "現場", targetDate: new Date(Date.UTC(2026, 9, 1)), category: "重機", name: "請求する重機", quantity: 1, unitPrice: 10000, amount: 10000 },
        { projectName: "現場", targetDate: new Date(Date.UTC(2026, 9, 1)), category: "重機", name: "原価だけの機械", quantity: 1, unitPrice: 45000, amount: 45000, isBillable: false },
      ],
    });
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const rows: Record<string, string> = {};
    wb.getWorksheet("出面集計表")!.eachRow((row) => {
      const label = row.getCell(6).value?.toString() ?? "";
      if (label.includes("合計")) rows[label] = row.getCell(7).value?.toString() ?? "";
    });
    expect(rows["車両・重機・経費 合計"]).toBe("55000"); // 経費はすべて並べて見せる
    expect(rows["月間合計(請求金額+請求に含める車両重機経費)"]).toBe("30000"); // 20,000 + 請求する10,000(原価の45,000は足さない)
  });
});
