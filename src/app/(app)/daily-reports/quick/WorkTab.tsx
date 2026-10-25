"use client";

import { useState } from "react";
import type { QuickMasterData } from "@/lib/dailyReport/masters";
import type { QuickWork } from "@/lib/dailyReport/quickInput";
import { normalizeName } from "@/lib/dailyReport/standardMasters";
import { ChoiceButton, FieldBox, SearchBox, SelectedCard, inputClass, matchesQuery, newKey } from "./parts";

const UNITS = ["m", "㎡", "㎥", "箇所", "枚", "本", "t", "式"];

function isSelected(works: QuickWork[], label: string, id: string): boolean {
  return works.some((w) => w.workItemId === id || normalizeName(w.label) === normalizeName(label));
}

export function WorkTab({
  masters,
  works,
  onChange,
}: {
  masters: QuickMasterData;
  works: QuickWork[];
  onChange: (works: QuickWork[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");

  function toggle(item: QuickMasterData["works"][number]) {
    const existing = works.find((w) => w.workItemId === item.id || normalizeName(w.label) === normalizeName(item.label));
    if (existing) {
      // 数量や時間まで入力済みのものを、うっかり消さないように確認する。
      const filled = existing.quantity != null || existing.workMinutes != null || existing.remarks;
      if (filled && !window.confirm(`「${existing.label}」の入力内容も消えます。選択を外しますか?`)) return;
      onChange(works.filter((w) => w.key !== existing.key));
      return;
    }
    onChange([
      ...works,
      {
        key: newKey(),
        workItemId: item.id,
        label: item.label,
        quantity: null,
        unit: item.defaultUnit,
        workMinutes: null,
        remarks: null,
      },
    ]);
  }

  function update(key: string, patch: Partial<QuickWork>) {
    onChange(works.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  }

  function addCustom() {
    const label = custom.trim();
    if (!label) return;
    if (!works.some((w) => normalizeName(w.label) === normalizeName(label))) {
      onChange([
        ...works,
        { key: newKey(), workItemId: null, label, quantity: null, unit: null, workMinutes: null, remarks: null },
      ]);
    }
    setCustom("");
  }

  const shown = masters.works.filter((w) => matchesQuery(w.label, query));

  return (
    <div className="flex flex-col gap-4">
      <SearchBox value={query} onChange={setQuery} placeholder="作業内容を探す" />

      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((item) => (
          <ChoiceButton key={item.id} selected={isSelected(works, item.label, item.id)} onClick={() => toggle(item)}>
            {item.isFavorite && <span className="mr-1 text-amber-400">★</span>}
            {item.label}
          </ChoiceButton>
        ))}
        {shown.length === 0 && <p className="col-span-2 py-3 text-center text-sm text-slate-500">見つかりませんでした。</p>}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="一覧にない作業を入力して追加"
          aria-label="一覧にない作業を入力"
          className={inputClass}
          maxLength={100}
        />
        <button
          type="button"
          onClick={addCustom}
          className="min-h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 active:bg-slate-100"
        >
          追加
        </button>
      </div>

      {works.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-700">選んだ作業の詳細(数量などは省略できます)</h3>
          {works.map((w) => (
            <SelectedCard key={w.key} title={w.label} onRemove={() => onChange(works.filter((x) => x.key !== w.key))}>
              <div className="grid grid-cols-2 gap-2.5">
                <FieldBox label="施工数量">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={w.quantity ?? ""}
                    onChange={(e) => update(w.key, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
                    className={inputClass}
                  />
                </FieldBox>
                <FieldBox label="単位">
                  <select
                    value={w.unit ?? ""}
                    onChange={(e) => update(w.key, { unit: e.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">なし</option>
                    {w.unit && !UNITS.includes(w.unit) && <option value={w.unit}>{w.unit}</option>}
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </FieldBox>
                <FieldBox label="作業時間(時間)">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={24}
                    step="0.5"
                    value={w.workMinutes == null ? "" : Math.round((w.workMinutes / 60) * 100) / 100}
                    onChange={(e) =>
                      update(w.key, { workMinutes: e.target.value === "" ? null : Math.round(Number(e.target.value) * 60) })
                    }
                    className={inputClass}
                  />
                </FieldBox>
                <FieldBox label="備考">
                  <input
                    value={w.remarks ?? ""}
                    onChange={(e) => update(w.key, { remarks: e.target.value || null })}
                    className={inputClass}
                    maxLength={200}
                  />
                </FieldBox>
              </div>
            </SelectedCard>
          ))}
        </div>
      )}
    </div>
  );
}
