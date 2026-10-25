"use client";

import { useMemo, useState } from "react";
import type { QuickMasterData } from "@/lib/dailyReport/masters";
import { machineAmount, type QuickMachine } from "@/lib/dailyReport/quickInput";
import { normalizeName, suggestMachinesForWorks } from "@/lib/dailyReport/standardMasters";
import { ChoiceButton, SearchBox, SelectedCard, Stepper, inputClass, matchesQuery, newKey, yen } from "./parts";

type MasterMachine = QuickMasterData["machines"][number];

function matchesMachine(entry: QuickMachine, master: MasterMachine): boolean {
  return entry.machineId === master.id || normalizeName(entry.name) === normalizeName(master.name);
}

export function MachineTab({
  masters,
  machines,
  workLabels,
  onChange,
}: {
  masters: QuickMasterData;
  machines: QuickMachine[];
  workLabels: string[];
  onChange: (machines: QuickMachine[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");

  // 選んだ作業内容から、おすすめの機械。提案だけで、押すまで確定しない。
  // 選んだあとも同じ場所に残し、押した状態(色の変化)で分かるようにする(位置が動いて迷わないように)。
  const recommended = useMemo(() => {
    const names = suggestMachinesForWorks(workLabels).map(normalizeName);
    return masters.machines.filter((m) => names.includes(normalizeName(m.name)));
  }, [masters.machines, workLabels]);
  const unselectedRecommended = recommended.filter((m) => !machines.some((e) => matchesMachine(e, m)));

  function add(master: MasterMachine) {
    onChange([
      ...machines,
      {
        key: newKey(),
        id: null,
        machineId: master.id,
        name: master.name,
        ownership: master.ownership,
        quantity: 1,
        usageValue: 1,
      },
    ]);
  }

  function toggle(master: MasterMachine) {
    const existing = machines.filter((e) => matchesMachine(e, master));
    if (existing.length > 0) {
      onChange(machines.filter((e) => !matchesMachine(e, master)));
    } else {
      add(master);
    }
  }

  function update(key: string, patch: Partial<QuickMachine>) {
    onChange(machines.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  function addCustom() {
    const name = custom.trim();
    if (!name) return;
    if (!machines.some((m) => normalizeName(m.name) === normalizeName(name))) {
      onChange([
        ...machines,
        { key: newKey(), id: null, machineId: null, name, ownership: "OWN", quantity: 1, usageValue: 1 },
      ]);
    }
    setCustom("");
  }

  const searching = query.trim().length > 0;
  const recommendedIds = new Set(recommended.map((m) => m.id));
  const shown = masters.machines.filter(
    (m) => matchesQuery(m.name, query) && (searching || !recommendedIds.has(m.id))
  );

  return (
    <div className="flex flex-col gap-4">
      {recommended.length > 0 && !searching && (
        <div className="flex flex-col gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-indigo-900">選んだ作業で使うことが多い機械</p>
            {unselectedRecommended.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChange([
                    ...machines,
                    ...unselectedRecommended.map((m) => ({
                      key: newKey(),
                      id: null,
                      machineId: m.id,
                      name: m.name,
                      ownership: m.ownership,
                      quantity: 1,
                      usageValue: 1,
                    })),
                  ])
                }
                className="min-h-10 shrink-0 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white active:bg-indigo-700"
              >
                全部追加
              </button>
            )}
          </div>
          <p className="text-xs text-indigo-700">提案です。使うものだけ押して選んでください(もう一度押すと外れます)。</p>
          <div className="grid grid-cols-2 gap-3 pt-1.5">
            {recommended.map((m) => (
              <ChoiceButton
                key={m.id}
                selected={machines.some((e) => matchesMachine(e, m))}
                tone="recommended"
                badge="おすすめ"
                onClick={() => toggle(m)}
              >
                {m.name}
              </ChoiceButton>
            ))}
          </div>
        </div>
      )}

      <SearchBox value={query} onChange={setQuery} placeholder="機械を探す" />

      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((m) => (
          <ChoiceButton key={m.id} selected={machines.some((e) => matchesMachine(e, m))} onClick={() => toggle(m)}>
            {m.isFavorite && <span className="mr-1 text-amber-400">★</span>}
            {m.name}
          </ChoiceButton>
        ))}
        {shown.length === 0 && <p className="col-span-2 py-3 text-center text-sm text-slate-500">見つかりませんでした。</p>}
      </div>

      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="一覧にない機械を入力して追加"
          aria-label="一覧にない機械を入力"
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

      {machines.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-700">選んだ機械</h3>
          {machines.map((m) => {
            const master = masters.machines.find((x) => x.id === m.machineId);
            const priceUnit = master?.priceUnit ?? "DAY";
            const unitLabel = priceUnit === "HOUR" ? "時間" : "日";
            const price = master?.unitPrice ?? null;
            const amount = machineAmount(m.quantity, m.usageValue, price);
            const warning = master?.includesOperator
              ? "運転手込みの単価です。労務で重機オペレーターの人工を別に入れると、二重になるので注意してください。"
              : !master
                ? "機械の一覧にないため、金額は計算されません。"
                : null;
            return (
              <SelectedCard
                key={m.key}
                title={
                  <>
                    {m.name}
                    {m.ownership === "RENTAL" && (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">レンタル</span>
                    )}
                  </>
                }
                onRemove={() => onChange(machines.filter((x) => x.key !== m.key))}
                warning={warning}
              >
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                    <span>使用台数</span>
                    <Stepper
                      label="使用台数"
                      value={m.quantity}
                      min={1}
                      max={100}
                      onChange={(quantity) => update(m.key, { quantity })}
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                    <span>使用{priceUnit === "HOUR" ? "時間" : "日数"}</span>
                    <Stepper
                      label={`使用${priceUnit === "HOUR" ? "時間" : "日数"}`}
                      value={m.usageValue}
                      min={0.5}
                      max={priceUnit === "HOUR" ? 24 : 31}
                      step={0.5}
                      onChange={(usageValue) => update(m.key, { usageValue })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="自社所有かレンタルか">
                  {(["OWN", "RENTAL"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={m.ownership === o}
                      onClick={() => update(m.key, { ownership: o })}
                      className={`min-h-12 rounded-xl border-2 text-sm font-semibold ${
                        m.ownership === o
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {o === "OWN" ? "自社所有" : "レンタル"}
                    </button>
                  ))}
                </div>
                {masters.canSeeCosts && (
                  <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    {price != null ? (
                      <>
                        単価 {yen(price)}/{unitLabel} → 使用金額(目安){" "}
                        <span className="font-semibold">{amount != null ? yen(amount) : "—"}</span>
                      </>
                    ) : (
                      <span className="text-amber-700">単価未登録(マスタ管理で登録すると金額が出ます)</span>
                    )}
                  </p>
                )}
              </SelectedCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
