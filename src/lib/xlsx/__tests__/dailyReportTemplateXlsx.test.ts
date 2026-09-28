import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildDailyReportXlsxFromTemplate,
  DailyReportTemplateTooManyWorkersError,
} from "@/lib/xlsx/dailyReportTemplateXlsx";
import type { DailyReportXlsxInput } from "@/lib/xlsx/dailyReportTemplateXlsx";

async function makeSampleTemplate(): Promise<Buffer<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  const cover = wb.addWorksheet("表紙");
  cover.getCell("B2").value = "作業日報"; // 固定文言(触ってはいけない)
  cover.getCell("C4").value = ""; // 現場名を書く欄
  cover.getCell("H5").value = ""; // 天候を書く欄
  const workers = wb.addWorksheet("作業員一覧");
  workers.getCell("B2").value = "氏名"; // ヘッダー(固定文言)
  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}

const baseInput: DailyReportXlsxInput = {
  companyName: "テスト建設株式会社",
  projectName: "サンプル現場外構工事",
  siteAddress: null,
  reportDateText: "2026年09月29日",
  weather: "晴れ",
  foremanName: "山田",
  workerCount: 2,
  startTime: "08:00",
  endTime: "17:00",
  breakMinutes: 60,
  workContent: "掘削工",
  machinery: null,
  vehicles: null,
  materials: null,
  subcontractors: null,
  quantityWorked: null,
  safetyNotes: null,
  dangerPrediction: null,
  nextDayPlan: null,
  issues: null,
  remarks: null,
  workers: [
    { workerName: "山田太郎", role: "職長", startTime: "08:00", endTime: "17:00", workDescription: "掘削", manDays: 1 },
    { workerName: "鈴木次郎", role: null, startTime: "08:00", endTime: "17:00", workDescription: null, manDays: 1 },
  ],
};

describe("buildDailyReportXlsxFromTemplate", () => {
  it("割り当てたセル・列だけを書き込み、固定文言は変えない", async () => {
    const fileData = await makeSampleTemplate();
    const buffer = await buildDailyReportXlsxFromTemplate(
      {
        fileData,
        sheetName: "表紙",
        fieldMappingJson: JSON.stringify({ PROJECT_NAME: "C4", WEATHER: "H5" }),
        workerSheetName: "作業員一覧",
        workerStartRow: 3,
        workerMaxRows: 10,
        workerColumnsJson: JSON.stringify({ workerName: "B", role: "C", startTime: "D", endTime: "E" }),
      },
      baseInput
    );

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const cover = wb.getWorksheet("表紙")!;
    const workers = wb.getWorksheet("作業員一覧")!;

    expect(cover.getCell("B2").value).toBe("作業日報"); // 固定文言のまま
    expect(cover.getCell("C4").value).toBe("サンプル現場外構工事");
    expect(cover.getCell("H5").value).toBe("晴れ");

    expect(workers.getCell("B2").value).toBe("氏名"); // ヘッダー固定文言のまま
    expect(workers.getCell("B3").value).toBe("山田太郎");
    expect(workers.getCell("C3").value).toBe("職長");
    expect(workers.getCell("B4").value).toBe("鈴木次郎");
    expect(workers.getCell("C4").value).toBe(""); // role未入力は空文字
  });

  it("最大人数を超える場合はエラーにし、途中までの出力はしない", async () => {
    const fileData = await makeSampleTemplate();
    await expect(
      buildDailyReportXlsxFromTemplate(
        {
          fileData,
          sheetName: "表紙",
          fieldMappingJson: "{}",
          workerSheetName: "作業員一覧",
          workerStartRow: 3,
          workerMaxRows: 1, // 作業員は2名いるのに上限1名
          workerColumnsJson: JSON.stringify({ workerName: "B" }),
        },
        baseInput
      )
    ).rejects.toBeInstanceOf(DailyReportTemplateTooManyWorkersError);
  });
});
