"use client";

import { useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { saveDailyReportTemplateMappingAction } from "../../../../actions";
import {
  DAILY_REPORT_TEMPLATE_FIELD_KEYS,
  DAILY_REPORT_TEMPLATE_FIELD_LABEL,
  DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS,
  DAILY_REPORT_TEMPLATE_WORKER_COLUMN_LABEL,
  type DailyReportTemplateFieldKey,
  type DailyReportTemplateFieldMapping,
  type DailyReportTemplateWorkerColumnKey,
  type DailyReportTemplateWorkerColumns,
} from "@/lib/xlsx/dailyReportTemplateFields";
import type { SheetPreview } from "@/lib/xlsx/sheetPreview";

type Props = {
  templateId: string;
  versionId: string;
  sheetNames: string[];
  previews: Record<string, SheetPreview | null>;
  initialCoverSheetName: string;
  initialWorkerSheetName: string;
  initialFieldMapping: DailyReportTemplateFieldMapping;
  initialWorkerColumns: DailyReportTemplateWorkerColumns;
  initialWorkerStartRow: number;
  initialWorkerMaxRows: number;
};

type PendingCell = { address: string; rowNumber: number } | null;

export function DailyReportTemplateMappingEditor({
  templateId,
  versionId,
  sheetNames,
  previews,
  initialCoverSheetName,
  initialWorkerSheetName,
  initialFieldMapping,
  initialWorkerColumns,
  initialWorkerStartRow,
  initialWorkerMaxRows,
}: Props) {
  const [tab, setTab] = useState<"cover" | "worker">("cover");
  const [coverSheetName, setCoverSheetName] = useState(initialCoverSheetName);
  const [workerSheetName, setWorkerSheetName] = useState(initialWorkerSheetName);
  const [fieldMapping, setFieldMapping] = useState<DailyReportTemplateFieldMapping>(initialFieldMapping);
  const [workerColumns, setWorkerColumns] = useState<DailyReportTemplateWorkerColumns>(initialWorkerColumns);
  const [workerStartRow, setWorkerStartRow] = useState(initialWorkerStartRow || 2);
  const [workerMaxRows, setWorkerMaxRows] = useState(initialWorkerMaxRows || 20);
  const [pendingCell, setPendingCell] = useState<PendingCell>(null);

  const currentSheetName = tab === "cover" ? coverSheetName : workerSheetName;
  const preview = previews[currentSheetName];

  const assignedAddressToField = useMemo(() => {
    const map = new Map<string, DailyReportTemplateFieldKey>();
    for (const [key, address] of Object.entries(fieldMapping)) map.set(address, key as DailyReportTemplateFieldKey);
    return map;
  }, [fieldMapping]);

  const columnLetterFromAddress = (address: string) => address.match(/^[A-Z]+/)?.[0] ?? "";
  const assignedColumnToWorkerKey = useMemo(() => {
    const map = new Map<string, DailyReportTemplateWorkerColumnKey>();
    for (const [key, col] of Object.entries(workerColumns)) map.set(col, key as DailyReportTemplateWorkerColumnKey);
    return map;
  }, [workerColumns]);

  function handleCellClick(address: string, rowNumber: number) {
    if (tab === "worker" && rowNumber !== workerStartRow) return; // 作業員一覧は開始行のセルだけ割り当て対象にする
    setPendingCell({ address, rowNumber });
  }

  function assignCoverField(key: DailyReportTemplateFieldKey) {
    if (!pendingCell) return;
    setFieldMapping((prev) => ({ ...prev, [key]: pendingCell.address }));
    setPendingCell(null);
  }

  function clearCoverField(key: DailyReportTemplateFieldKey) {
    setFieldMapping((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function assignWorkerColumn(key: DailyReportTemplateWorkerColumnKey) {
    if (!pendingCell) return;
    setWorkerColumns((prev) => ({ ...prev, [key]: columnLetterFromAddress(pendingCell.address) }));
    setPendingCell(null);
  }

  function clearWorkerColumn(key: DailyReportTemplateWorkerColumnKey) {
    setWorkerColumns((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const unassignedCoverKeys = DAILY_REPORT_TEMPLATE_FIELD_KEYS.filter((k) => !(k in fieldMapping));
  const unassignedWorkerKeys = DAILY_REPORT_TEMPLATE_WORKER_COLUMN_KEYS.filter((k) => !(k in workerColumns));

  return (
    <form action={saveDailyReportTemplateMappingAction} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="sheetName" value={coverSheetName} />
      <input type="hidden" name="workerSheetName" value={workerSheetName} />
      <input type="hidden" name="workerStartRow" value={workerStartRow} />
      <input type="hidden" name="workerMaxRows" value={workerMaxRows} />
      {Object.entries(fieldMapping).map(([key, address]) => (
        <input key={key} type="hidden" name={`field_${key}`} value={address} />
      ))}
      {Object.entries(workerColumns).map(([key, col]) => (
        <input key={key} type="hidden" name={`worker_${key}`} value={col} />
      ))}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("cover")}
          className={`px-3 py-2 text-sm font-medium ${tab === "cover" ? "border-b-2 border-amber-500 text-slate-900" : "text-slate-500"}`}
        >
          基本情報
        </button>
        <button
          type="button"
          onClick={() => setTab("worker")}
          className={`px-3 py-2 text-sm font-medium ${tab === "worker" ? "border-b-2 border-amber-500 text-slate-900" : "text-slate-500"}`}
        >
          作業員一覧
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
              else setWorkerSheetName(e.target.value);
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
        {tab === "worker" && (
          <>
            <label className="flex items-center gap-2">
              作業員一覧の開始行:
              <input
                type="number"
                min={1}
                value={workerStartRow}
                onChange={(e) => setWorkerStartRow(Number(e.target.value) || 1)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              最大人数:
              <input
                type="number"
                min={0}
                max={500}
                value={workerMaxRows}
                onChange={(e) => setWorkerMaxRows(Number(e.target.value) || 0)}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>
            <span className="text-slate-500">これより人数が多い日報は、出力時にエラーで知らせます(途中までの出力はしません)。</span>
          </>
        )}
      </div>

      {tab === "worker" && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {workerStartRow}行目のセルをクリックして、その列が「氏名」「職種」等のどれに当たるかを選んでください
          (この行から下へ、指定した最大人数ぶん同じ列に書き込みます)。
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
                const dimmed = tab === "worker" && rowNumber !== workerStartRow;
                return (
                  <tr key={rowNumber}>
                    {row.map((cell, colIdx) => {
                      if (cell.isMergedAway) return null;
                      const assignedCover = tab === "cover" ? assignedAddressToField.get(cell.address) : undefined;
                      const assignedWorker =
                        tab === "worker" && rowNumber === workerStartRow
                          ? assignedColumnToWorkerKey.get(columnLetterFromAddress(cell.address))
                          : undefined;
                      const isPending = pendingCell?.address === cell.address;
                      const clickable = tab === "cover" || rowNumber === workerStartRow;
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
                            assignedCover || assignedWorker ? "bg-emerald-50" : "",
                          ].join(" ")}
                          title={cell.address}
                        >
                          <div className="text-[10px] text-slate-400">{cell.address}</div>
                          <div className="truncate">{cell.text}</div>
                          {assignedCover && (
                            <div className="mt-0.5 inline-block rounded bg-emerald-600 px-1 py-0.5 text-[10px] text-white">
                              {DAILY_REPORT_TEMPLATE_FIELD_LABEL[assignedCover]}
                            </div>
                          )}
                          {assignedWorker && (
                            <div className="mt-0.5 inline-block rounded bg-emerald-600 px-1 py-0.5 text-[10px] text-white">
                              {DAILY_REPORT_TEMPLATE_WORKER_COLUMN_LABEL[assignedWorker]}
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
            <Select
              className="w-auto"
              defaultValue=""
              onChange={(e) => e.target.value && assignCoverField(e.target.value as DailyReportTemplateFieldKey)}
            >
              <option value="" disabled>
                何を書き込みますか?
              </option>
              {unassignedCoverKeys.map((key) => (
                <option key={key} value={key}>
                  {DAILY_REPORT_TEMPLATE_FIELD_LABEL[key]}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              className="w-auto"
              defaultValue=""
              onChange={(e) => e.target.value && assignWorkerColumn(e.target.value as DailyReportTemplateWorkerColumnKey)}
            >
              <option value="" disabled>
                この列は何ですか?
              </option>
              {unassignedWorkerKeys.map((key) => (
                <option key={key} value={key}>
                  {DAILY_REPORT_TEMPLATE_WORKER_COLUMN_LABEL[key]}
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
                {DAILY_REPORT_TEMPLATE_FIELD_LABEL[key as DailyReportTemplateFieldKey]} = {address}
                <button
                  type="button"
                  onClick={() => clearCoverField(key as DailyReportTemplateFieldKey)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))
          : Object.entries(workerColumns).map(([key, col]) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs">
                {DAILY_REPORT_TEMPLATE_WORKER_COLUMN_LABEL[key as DailyReportTemplateWorkerColumnKey]} = {col}列
                <button
                  type="button"
                  onClick={() => clearWorkerColumn(key as DailyReportTemplateWorkerColumnKey)}
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
