import ExcelJS from "exceljs";
import { amountOf, sumRows } from "@/lib/timesheet/siteAttendanceTotals";

export type SiteAttendanceXlsxLaborRow = {
  primeContractorName: string | null;
  projectName: string;
  targetDate: Date;
  workerName: string;
  jobType: string | null;
  workContent: string | null;
  manDays: number;
  isBillable: boolean;
  isCostTarget: boolean;
  manDayUnitPrice: number | null; // 請求単価
  laborCostUnitPrice: number | null; // 原価単価
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

  // 請求(元請へ請求する額)と原価(自社の労務費)を別の列にする(調査報告F10)。
  // 未入力は空欄のまま(0円として埋めない)にし、合計の下に未入力件数を書く。
  const laborHeaders = [
    "元請会社",
    "現場名",
    "日付",
    "作業員名",
    "職種",
    "作業内容",
    "人工数",
    "請求単価",
    "請求金額",
    "原価単価",
    "原価金額",
  ];
  const laborHeaderRow = ws.addRow(laborHeaders);
  laborHeaderRow.font = { bold: true };
  laborHeaderRow.eachCell((cell) => (cell.border = { bottom: { style: "thin" } }));

  for (const r of params.laborRows) {
    ws.addRow([
      r.primeContractorName ?? "",
      r.projectName,
      `${r.targetDate.getUTCMonth() + 1}/${r.targetDate.getUTCDate()}`,
      r.workerName,
      r.jobType ?? "",
      r.workContent ?? "",
      r.manDays,
      r.manDayUnitPrice ?? "",
      r.isBillable ? (amountOf(r.manDays, r.manDayUnitPrice) ?? "") : "請求対象外",
      r.laborCostUnitPrice ?? "",
      r.isCostTarget ? (amountOf(r.manDays, r.laborCostUnitPrice) ?? "") : "原価対象外",
    ]);
  }
  const totals = sumRows(params.laborRows);
  const laborTotal = totals.billing;
  const laborTotalRow = ws.addRow(["", "", "", "", "", "合計", "", "", totals.billing, "", totals.laborCost]);
  laborTotalRow.font = { bold: true };
  ws.addRow([
    "",
    "",
    "",
    "",
    "",
    "粗利(請求−原価)",
    "",
    "",
    "",
    "",
    totals.grossProfit ?? "単価未入力があるため計算しません",
  ]);
  if (totals.billingMissing > 0 || totals.laborCostMissing > 0) {
    ws.addRow([
      "",
      "",
      "",
      "",
      "",
      `単価未入力: 請求 ${totals.billingMissing}件 / 原価 ${totals.laborCostMissing}件(合計には含めていません)`,
    ]);
  }

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
  const grandTotalRow = ws.addRow(["", "", "", "", "", "月間合計(請求金額+車両重機経費)", laborTotal + expenseTotal]);
  grandTotalRow.font = { bold: true };
  grandTotalRow.eachCell((cell) => (cell.border = { top: { style: "double" } }));

  laborHeaders.forEach((_, i) => ws.getColumn(i + 1).width = i === 5 ? 24 : 12);

  const written = await wb.xlsx.writeBuffer();
  const arrayBuffer = new ArrayBuffer(written.byteLength);
  new Uint8Array(arrayBuffer).set(new Uint8Array(written));
  return Buffer.from(arrayBuffer);
}
