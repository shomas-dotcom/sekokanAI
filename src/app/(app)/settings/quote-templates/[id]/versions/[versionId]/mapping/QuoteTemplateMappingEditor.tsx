"use client";

import { useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { saveQuoteTemplateMappingAction } from "../../../../actions";
import {
  QUOTE_TEMPLATE_FIELD_KEYS,
  QUOTE_TEMPLATE_FIELD_LABEL,
  QUOTE_TEMPLATE_ITEM_COLUMN_KEYS,
  QUOTE_TEMPLATE_ITEM_COLUMN_LABEL,
  type QuoteTemplateFieldKey,
  type QuoteTemplateFieldMapping,
  type QuoteTemplateItemColumnKey,
  type QuoteTemplateItemColumns,
} from "@/lib/xlsx/quoteTemplateFields";
import type { SheetPreview } from "@/lib/xlsx/sheetPreview";

type Props = {
  templateId: string;
  versionId: string;
  sheetNames: string[];
  previews: Record<string, SheetPreview | null>;
  initialCoverSheetName: string;
  initialItemSheetName: string;
  initialFieldMapping: QuoteTemplateFieldMapping;
  initialItemColumns: QuoteTemplateItemColumns;
  initialItemStartRow: number;
  initialItemMaxRows: number;
};

type PendingCell = { address: string; rowNumber: number } | null;

export function QuoteTemplateMappingEditor({
  templateId,
  versionId,
  sheetNames,
  previews,
  initialCoverSheetName,
  initialItemSheetName,
  initialFieldMapping,
  initialItemColumns,
  initialItemStartRow,
  initialItemMaxRows,
}: Props) {
  const [tab, setTab] = useState<"cover" | "item">("cover");
  const [coverSheetName, setCoverSheetName] = useState(initialCoverSheetName);
  const [itemSheetName, setItemSheetName] = useState(initialItemSheetName);
  const [fieldMapping, setFieldMapping] = useState<QuoteTemplateFieldMapping>(initialFieldMapping);
  const [itemColumns, setItemColumns] = useState<QuoteTemplateItemColumns>(initialItemColumns);
  const [itemStartRow, setItemStartRow] = useState(initialItemStartRow || 2);
  const [itemMaxRows, setItemMaxRows] = useState(initialItemMaxRows || 20);
  const [pendingCell, setPendingCell] = useState<PendingCell>(null);

  const currentSheetName = tab === "cover" ? coverSheetName : itemSheetName;
  const preview = previews[currentSheetName];

  const assignedAddressToField = useMemo(() => {
    const map = new Map<string, QuoteTemplateFieldKey>();
    for (const [key, address] of Object.entries(fieldMapping)) map.set(address, key as QuoteTemplateFieldKey);
    return map;
  }, [fieldMapping]);

  // 明細タブでは「列」に対する割り当てなので、開始行のセル番地(例: E10)から列(E)を求めて表示する。
  const columnLetterFromAddress = (address: string) => address.match(/^[A-Z]+/)?.[0] ?? "";
  const assignedColumnToItemKey = useMemo(() => {
    const map = new Map<string, QuoteTemplateItemColumnKey>();
    for (const [key, col] of Object.entries(itemColumns)) map.set(col, key as QuoteTemplateItemColumnKey);
    return map;
  }, [itemColumns]);

  function handleCellClick(address: string, rowNumber: number) {
    if (tab === "item" && rowNumber !== itemStartRow) return; // 明細は開始行のセルだけ割り当て対象にする
    setPendingCell({ address, rowNumber });
  }

  function assignCoverField(key: QuoteTemplateFieldKey) {
    if (!pendingCell) return;
    setFieldMapping((prev) => ({ ...prev, [key]: pendingCell.address }));
    setPendingCell(null);
  }

  function clearCoverField(key: QuoteTemplateFieldKey) {
    setFieldMapping((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function assignItemColumn(key: QuoteTemplateItemColumnKey) {
    if (!pendingCell) return;
    setItemColumns((prev) => ({ ...prev, [key]: columnLetterFromAddress(pendingCell.address) }));
    setPendingCell(null);
  }

  function clearItemColumn(key: QuoteTemplateItemColumnKey) {
    setItemColumns((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const unassignedCoverKeys = QUOTE_TEMPLATE_FIELD_KEYS.filter((k) => !(k in fieldMapping));
  const unassignedItemKeys = QUOTE_TEMPLATE_ITEM_COLUMN_KEYS.filter((k) => !(k in itemColumns));

  return (
    <form action={saveQuoteTemplateMappingAction} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="sheetName" value={coverSheetName} />
      <input type="hidden" name="itemSheetName" value={itemSheetName} />
      <input type="hidden" name="itemStartRow" value={itemStartRow} />
      <input type="hidden" name="itemMaxRows" value={itemMaxRows} />
      {Object.entries(fieldMapping).map(([key, address]) => (
        <input key={key} type="hidden" name={`field_${key}`} value={address} />
      ))}
      {Object.entries(itemColumns).map(([key, col]) => (
        <input key={key} type="hidden" name={`item_${key}`} value={col} />
      ))}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("cover")}
          className={`px-3 py-2 text-sm font-medium ${tab === "cover" ? "border-b-2 border-amber-500 text-slate-900" : "text-slate-500"}`}
        >
          基本情報(表紙)
        </button>
        <button
          type="button"
          onClick={() => setTab("item")}
          className={`px-3 py-2 text-sm font-medium ${tab === "item" ? "border-b-2 border-amber-500 text-slate-900" : "text-slate-500"}`}
        >
          明細(工事項目の一覧)
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          シート:
          <Select
            value={currentSheetName}
            onChange={(e) => {
              setPendingCell(null);
              if (tab === "cover") setCoverSheetName(e.target.value);
              else setItemSheetName(e.target.value);
            }}
            className="w-auto"
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
        {tab === "item" && (
          <>
            <label className="flex items-center gap-2">
              明細の開始行:
              <input
                type="number"
                min={1}
                value={itemStartRow}
                onChange={(e) => setItemStartRow(Number(e.target.value) || 1)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              最大明細件数:
              <input
                type="number"
                min={0}
                max={500}
                value={itemMaxRows}
                onChange={(e) => setItemMaxRows(Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            <span className="text-slate-500">これより明細が多い見積は、出力時にエラーで知らせます(途中までの出力はしません)。</span>
          </>
        )}
      </div>

      {tab === "item" && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {itemStartRow}行目のセルをクリックして、その列が「数量」「単価」等のどれに当たるかを選んでください
          (この行から下へ、指定した最大件数ぶん同じ列に書き込みます)。
        </p>
      )}

      {!preview ? (
        <p className="text-sm text-rose-600">このシートを読み込めませんでした。</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200" style={{ maxHeight: 480 }}>
          <table className="border-collapse text-xs">
            <tbody>
              {preview.rows.map((row, rowIdx) => {
                const rowNumber = rowIdx + 1;
                const dimmed = tab === "item" && rowNumber !== itemStartRow;
                return (
                  <tr key={rowNumber}>
                    {row.map((cell, colIdx) => {
                      if (cell.isMergedAway) return null;
                      const assignedCover = tab === "cover" ? assignedAddressToField.get(cell.address) : undefined;
                      const assignedItem =
                        tab === "item" && rowNumber === itemStartRow
                          ? assignedColumnToItemKey.get(columnLetterFromAddress(cell.address))
                          : undefined;
                      const isPending = pendingCell?.address === cell.address;
                      const clickable = tab === "cover" || rowNumber === itemStartRow;
                      return (
                        <td
                          key={colIdx}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          onClick={() => clickable && handleCellClick(cell.address, rowNumber)}
                          className={[
                            "min-w-[64px] border border-slate-200 px-1.5 py-1 align-top",
                            clickable ? "cursor-pointer hover:bg-amber-50" : "",
                            dimmed ? "bg-slate-50 text-slate-300" : "",
                            isPending ? "bg-amber-100 ring-2 ring-amber-400" : "",
                            assignedCover || assignedItem ? "bg-emerald-50" : "",
                          ].join(" ")}
                          title={cell.address}
                        >
                          <div className="text-[10px] text-slate-400">{cell.address}</div>
                          <div className="truncate">{cell.text}</div>
                          {assignedCover && (
                            <div className="mt-0.5 inline-block rounded bg-emerald-600 px-1 py-0.5 text-[10px] text-white">
                              {QUOTE_TEMPLATE_FIELD_LABEL[assignedCover]}
                            </div>
                          )}
                          {assignedItem && (
                            <div className="mt-0.5 inline-block rounded bg-emerald-600 px-1 py-0.5 text-[10px] text-white">
                              {QUOTE_TEMPLATE_ITEM_COLUMN_LABEL[assignedItem]}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingCell && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <span className="font-medium">選択中のセル: {pendingCell.address}</span>
          {tab === "cover" ? (
            <>
              <Select
                className="w-auto"
                defaultValue=""
                onChange={(e) => e.target.value && assignCoverField(e.target.value as QuoteTemplateFieldKey)}
              >
                <option value="" disabled>
                  何を書き込みますか?
                </option>
                {unassignedCoverKeys.map((key) => (
                  <option key={key} value={key}>
                    {QUOTE_TEMPLATE_FIELD_LABEL[key]}
                  </option>
                ))}
              </Select>
            </>
          ) : (
            <Select
              className="w-auto"
              defaultValue=""
              onChange={(e) => e.target.value && assignItemColumn(e.target.value as QuoteTemplateItemColumnKey)}
            >
              <option value="" disabled>
                この列は何ですか?
              </option>
              {unassignedItemKeys.map((key) => (
                <option key={key} value={key}>
                  {QUOTE_TEMPLATE_ITEM_COLUMN_LABEL[key]}
                </option>
              ))}
            </Select>
          )}
          <Button type="button" variant="ghost" onClick={() => setPendingCell(null)}>
            キャンセル
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tab === "cover"
          ? Object.entries(fieldMapping).map(([key, address]) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                {QUOTE_TEMPLATE_FIELD_LABEL[key as QuoteTemplateFieldKey]} = {address}
                <button
                  type="button"
                  onClick={() => clearCoverField(key as QuoteTemplateFieldKey)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))
          : Object.entries(itemColumns).map(([key, col]) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                {QUOTE_TEMPLATE_ITEM_COLUMN_LABEL[key as QuoteTemplateItemColumnKey]} = {col}列
                <button
                  type="button"
                  onClick={() => clearItemColumn(key as QuoteTemplateItemColumnKey)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))}
      </div>

      <div>
        <Button type="submit">この内容で保存する(新しいバージョンとして保存されます)</Button>
      </div>
    </form>
  );
}
