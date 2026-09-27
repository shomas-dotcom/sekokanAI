import ExcelJS from "exceljs";

// マッピング画面に表示する範囲(これより広い表は、右・下が見切れる。手入力でセル番地を
// 直接指定することもできるため、見えない部分にも割り当て自体は可能)。
const PREVIEW_MAX_ROWS = 60;
const PREVIEW_MAX_COLS = 40;

export type SheetPreviewCell = {
  address: string;
  text: string;
  // 結合セルの左上だけを表示し、それ以外は表示しない(colSpan/rowSpanで表現する)。
  colSpan: number;
  rowSpan: number;
  isMergedAway: boolean;
};

export type SheetPreview = {
  sheetName: string;
  rowCount: number;
  colCount: number;
  rows: SheetPreviewCell[][];
};

export type WorkbookSheetSummary = { name: string; rowCount: number; colCount: number };

export async function listWorkbookSheets(fileData: Buffer): Promise<WorkbookSheetSummary[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileData as unknown as ExcelJS.Buffer);
  return wb.worksheets.map((ws) => ({ name: ws.name, rowCount: ws.rowCount, colCount: ws.columnCount }));
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t) => t.text).join("");
  }
  if (typeof v === "object" && "formula" in v) {
    const result = (v as { result?: unknown }).result;
    return result != null ? String(result) : "";
  }
  if (v instanceof Date) return v.toLocaleDateString("ja-JP");
  return String(v);
}

/** マッピング画面でクリックして選べるように、シートの見た目(結合セル込み)をJSON化する。 */
export async function buildSheetPreview(fileData: Buffer, sheetName: string): Promise<SheetPreview | null> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileData as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) return null;

  // 実際に値・書式があるセルの範囲だけでなく、常に決まった大きさで表示する。
  // 明細の開始行を、まだ何も書かれていない行(罫線だけ後で引く想定の行など)に
  // 指定したいことがあるため、シートの実際の行数で打ち切らない。
  const rowCount = PREVIEW_MAX_ROWS;
  const colCount = PREVIEW_MAX_COLS;

  // "B2:D3" のような結合範囲文字列から、左上以外のマス目を「表示しない」対象にする。
  const mergedAway = new Set<string>();
  const spanOf = new Map<string, { colSpan: number; rowSpan: number }>();
  for (const range of ws.model.merges ?? []) {
    const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
    if (!match) continue;
    const [, colA, rowAStr, colB, rowBStr] = match;
    const rowA = Number(rowAStr);
    const rowB = Number(rowBStr);
    const colNumA = columnLetterToNumber(colA);
    const colNumB = columnLetterToNumber(colB);
    spanOf.set(`${rowA}:${colNumA}`, { colSpan: colNumB - colNumA + 1, rowSpan: rowB - rowA + 1 });
    for (let r = rowA; r <= rowB; r++) {
      for (let c = colNumA; c <= colNumB; c++) {
        if (r === rowA && c === colNumA) continue;
        mergedAway.add(`${r}:${c}`);
      }
    }
  }

  const rows: SheetPreviewCell[][] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = ws.getRow(r);
    const cells: SheetPreviewCell[] = [];
    for (let c = 1; c <= colCount; c++) {
      const key = `${r}:${c}`;
      const address = `${numberToColumnLetter(c)}${r}`;
      if (mergedAway.has(key)) {
        cells.push({ address, text: "", colSpan: 0, rowSpan: 0, isMergedAway: true });
        continue;
      }
      const span = spanOf.get(key);
      cells.push({
        address,
        text: cellText(row.getCell(c)),
        colSpan: span ? Math.min(span.colSpan, colCount - c + 1) : 1,
        rowSpan: span?.rowSpan ?? 1,
        isMergedAway: false,
      });
    }
    rows.push(cells);
  }

  return { sheetName, rowCount, colCount, rows };
}

export function columnLetterToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

export function numberToColumnLetter(num: number): string {
  let n = num;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
