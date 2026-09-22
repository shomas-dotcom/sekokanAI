import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildNippondoroXlsx } from "@/lib/xlsx/nippondoroXlsx";

describe("buildNippondoroXlsx", () => {
  it("テンプレートを壊さず可変項目を書き込める", async () => {
    const buffer = await buildNippondoroXlsx({
      siteAbbreviation: "テスト現場",
      reportDate: new Date(Date.UTC(2026, 8, 25)),
      weather: "晴れ",
      startTime: "08:00",
      endTime: "17:00",
      workTypes: [
        {
          workType: "雨水排水工事",
          subItem: "人孔",
          workArea: null,
          unit: "箇所",
          dailyQuantity: 2,
          cumulativeQuantity: 2,
          dailyWorkerCount: 7,
          cumulativeWorkerCount: 7,
          externalProviderName: "神部興業",
          externalProviderQuantity: 1,
          externalProviderUnitPrice: 21000,
        },
      ],
      materials: [
        {
          name: "エルボ",
          spec: "90",
          unit: "個",
          dailyQuantity: 36,
          cumulativeQuantity: 36,
          inspectionResult: "合",
          supplierName: "福山商事",
          remarks: null,
        },
      ],
      machinery: [{ machineType: "BH", spec: "0.7", operatorName: "神部興業", dailyCount: 1, cumulativeCount: 3 }],
    });

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    expect(ws.getCell("P2").value).toBe("テスト現場");
    expect(ws.getCell("A4").value).toBe(9); // 月
    expect(ws.getCell("C4").value).toBe(25); // 日
    expect(ws.getCell("E4").value).toBe("金"); // 2026-09-25はJSTで金曜
    expect(ws.getCell("H5").value).toBe("晴れ");
    expect(ws.getCell("A9").value).toBe("雨水排水工事");
    expect(ws.getCell("D9").value).toBe("人孔");
    expect(ws.getCell("N9").value).toBe(2); // 累計
    expect(ws.getCell("B21").value).toBe("エルボ");
    expect(ws.getCell("N21").value).toBe("合");
    expect(ws.getCell("D31").value).toBe("BH");
    expect(ws.getCell("D32").value).toBe("0.7");
    // 元の固定文面(法定チェック項目)が消えていないことを確認する
    expect(String(ws.getCell("B37").value)).toContain("アスベスト含有建材");
    expect(ws.getCell("I47").value).toBe("日本道路株式会社");
  });
});
