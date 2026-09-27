import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildQuoteXlsxFromTemplate, QuoteTemplateTooManyItemsError } from "@/lib/xlsx/quoteTemplateXlsx";
import type { QuoteXlsxInput } from "@/lib/xlsx/quoteXlsx";

async function makeSampleTemplate(): Promise<Buffer<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  const cover = wb.addWorksheet("表紙");
  cover.getCell("B2").value = "御見積書"; // 固定文言(触ってはいけない)
  cover.getCell("C4").value = ""; // 顧客名を書く欄
  cover.getCell("H18").value = ""; // 件名を書く欄
  cover.getCell("AB9").value = ""; // 税抜金額を書く欄
  const items = wb.addWorksheet("明細");
  items.getCell("B2").value = "工種"; // ヘッダー(固定文言)
  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}

const baseInput: QuoteXlsxInput = {
  companyName: "テスト建設株式会社",
  companyPostalCode: null,
  companyAddress: null,
  companyPhone: null,
  companyRepresentativeName: null,
  customerName: "サンプル商事",
  estimateNumber: "Q-001",
  issueDateText: "2026年09月27日",
  projectName: "サンプル現場外構工事",
  siteAddress: null,
  paymentTerms: null,
  expirationDateText: null,
  periodText: null,
  items: [
    { itemName: "ブロック積み", spec: "CB150", quantity: 10, unit: "m", unitPrice: 5000, remarks: "参考" },
    { itemName: "舗装工", spec: null, quantity: 20, unit: "m2", unitPrice: 3000 },
  ],
  subtotal: 110000,
  discountAmount: 0,
  taxRatePercent: 10,
  tax: 11000,
  total: 121000,
  notes: null,
};

describe("buildQuoteXlsxFromTemplate", () => {
  it("割り当てたセル・列だけを書き込み、固定文言は変えない", async () => {
    const fileData = await makeSampleTemplate();
    const buffer = await buildQuoteXlsxFromTemplate(
      {
        fileData,
        sheetName: "表紙",
        fieldMappingJson: JSON.stringify({ CUSTOMER_NAME: "C4", PROJECT_NAME: "H18", SUBTOTAL: "AB9" }),
        itemSheetName: "明細",
        itemStartRow: 3,
        itemMaxRows: 10,
        itemColumnsJson: JSON.stringify({ itemName: "B", spec: "C", quantity: "D", unit: "E", unitPrice: "F", remarks: "G" }),
      },
      baseInput
    );

    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
    const cover = wb.getWorksheet("表紙")!;
    const items = wb.getWorksheet("明細")!;

    expect(cover.getCell("B2").value).toBe("御見積書"); // 固定文言のまま
    expect(cover.getCell("C4").value).toBe("サンプル商事");
    expect(cover.getCell("H18").value).toBe("サンプル現場外構工事");
    expect(cover.getCell("AB9").value).toBe(110000);

    expect(items.getCell("B2").value).toBe("工種"); // ヘッダー固定文言のまま
    expect(items.getCell("B3").value).toBe("ブロック積み");
    expect(items.getCell("D3").value).toBe(10);
    expect(items.getCell("G3").value).toBe("参考");
    expect(items.getCell("B4").value).toBe("舗装工");
    expect(items.getCell("G4").value).toBe(""); // remarks未入力は空文字
  });

  it("最大明細件数を超える場合はエラーにし、途中までの出力はしない", async () => {
    const fileData = await makeSampleTemplate();
    await expect(
      buildQuoteXlsxFromTemplate(
        {
          fileData,
          sheetName: "表紙",
          fieldMappingJson: "{}",
          itemSheetName: "明細",
          itemStartRow: 3,
          itemMaxRows: 1, // 明細は2件あるのに上限1件
          itemColumnsJson: JSON.stringify({ itemName: "B" }),
        },
        baseInput
      )
    ).rejects.toBeInstanceOf(QuoteTemplateTooManyItemsError);
  });

  it("amount列を割り当てていなければ数式を壊さない(書き込まない)", async () => {
    const wb = new ExcelJS.Workbook();
    const cover = wb.addWorksheet("表紙");
    cover.getCell("C4").value = "";
    const items = wb.addWorksheet("明細");
    items.getCell("H3").value = { formula: "D3*F3", result: 0 };
    const written = await wb.xlsx.writeBuffer();
    const arrayBuffer = new ArrayBuffer(written.byteLength);
    new Uint8Array(arrayBuffer).set(new Uint8Array(written));
    const fileData = Buffer.from(arrayBuffer);

    const buffer = await buildQuoteXlsxFromTemplate(
      {
        fileData,
        sheetName: "表紙",
        fieldMappingJson: "{}",
        itemSheetName: "明細",
        itemStartRow: 3,
        itemMaxRows: 5,
        itemColumnsJson: JSON.stringify({ itemName: "B", quantity: "D", unitPrice: "F" }),
      },
      baseInput
    );

    const result = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await result.xlsx.load(buffer as any);
    const resultItems = result.getWorksheet("明細")!;
    const h3 = resultItems.getCell("H3").value as { formula?: string } | null;
    expect(h3 && typeof h3 === "object" ? h3.formula : null).toBe("D3*F3");
  });
});
