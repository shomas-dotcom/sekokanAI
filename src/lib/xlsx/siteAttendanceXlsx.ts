import ExcelJS from "exceljs";

export type SiteAttendanceXlsxLaborRow = {
  primeContractorName: string | null;
  projectName: string;
  targetDate: Date;
  workerName: string;
  jobType: string | null;
  workContent: string | null;
  manDays: number;
  manDayUnitPrice: number | null;
};

export type SiteAttendanceXlsxExpenseRow = {
  projectName: string;
  targetDate: Date;
  category: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  amount: number | null;
};

/** 出面集計表(REQUIREMENTS.md/依頼書のフェーズ8)。金額を含むため管理者専用の呼び出しとすること。 */
export async function buildSiteAttendanceXlsx(params: {
  companyName: string;
  periodLabel: string; // 例: "2026年09月"
  laborRows: SiteAttendanceXlsxLaborRow[];
  expenseRows: SiteAttendanceXlsxExpenseRow[];
}): Promise<Buffer<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("出面集計表", { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 } });

  ws.addRow([`${params.companyName} 出面集計表 ${params.periodLabel}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);

  const laborHeaders = ["元請会社", "現場名", "日付", "作業員名", "職種", "作業内容", "人工数", "人工単価", "人工金額"];
  const laborHeaderRow = ws.addRow(laborHeaders);
  laborHeaderRow.font = { bold: true };
  laborHeaderRow.eachCell((cell) => (cell.border = { bottom: { style: "thin" } }));

  let laborTotal = 0;
  for (const r of params.laborRows) {
    const amount = r.manDayUnitPrice != null ? Math.round(r.manDays * r.manDayUnitPrice) : null;
    if (amount != null) laborTotal += amount;
    ws.addRow([
      r.primeContractorName ?? "",
      r.projectName,
      `${r.targetDate.getUTCMonth() + 1}/${r.targetDate.getUTCDate()}`,
      r.workerName,
      r.jobType ?? "",
      r.workContent ?? "",
      r.manDays,
      r.manDayUnitPrice ?? "",
      amount ?? "",
    ]);
  }
  const laborTotalRow = ws.addRow(["", "", "", "", "", "人工金額 合計", "", "", laborTotal]);
  laborTotalRow.font = { bold: true };

  ws.addRow([]);
  const expenseHeaders = ["現場名", "日付", "区分", "名称", "数量", "単価", "金額"];
  const expenseHeaderRow = ws.addRow(expenseHeaders);
  expenseHeaderRow.font = { bold: true };
  expenseHeaderRow.eachCell((cell) => (cell.border = { bottom: { style: "thin" } }));

  let expenseTotal = 0;
  for (const r of params.expenseRows) {
    expenseTotal += r.amount ?? 0;
    ws.addRow([
      r.projectName,
      `${r.targetDate.getUTCMonth() + 1}/${r.targetDate.getUTCDate()}`,
      r.category,
      r.name,
      r.quantity,
      r.unitPrice ?? "",
      r.amount ?? "",
    ]);
  }
  const expenseTotalRow = ws.addRow(["", "", "", "", "", "車両・重機・経費 合計", expenseTotal]);
  expenseTotalRow.font = { bold: true };

  ws.addRow([]);
  const grandTotalRow = ws.addRow(["", "", "", "", "", "月間合計(人工金額+車両重機経費)", laborTotal + expenseTotal]);
  grandTotalRow.font = { bold: true };
  grandTotalRow.eachCell((cell) => (cell.border = { top: { style: "double" } }));

  laborHeaders.forEach((_, i) => ws.getColumn(i + 1).width = i === 5 ? 24 : 12);

  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
