"use client";

import { useMemo, useState } from "react";
import type { QuickMasterData } from "@/lib/dailyReport/masters";
import type { QuickKy } from "@/lib/dailyReport/quickInput";
import { normalizeName, suggestHazardsFor } from "@/lib/dailyReport/standardMasters";
import { ChoiceButton, SearchBox, SelectedCard, inputClass, matchesQuery, newKey } from "./parts";

type MasterHazard = QuickMasterData["hazards"][number];

function matchesHazard(entry: QuickKy, master: MasterHazard): boolean {
  return entry.hazardId === master.id || normalizeName(entry.label) === normalizeName(master.label);
}

export function KyTab({
  masters,
  ky,
  workLabels,
  machineNames,
  onChange,
}: {
  masters: QuickMasterData;
  ky: QuickKy[];
  workLabels: string[];
  machineNames: string[];
  onChange: (ky: QuickKy[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [customHazard, setCustomHazard] = useState("");
  const [customMeasure, setCustomMeasure] = useState<Record<string, string>>({});

  // 選んだ作業・機械に関係する危険を先頭に出す(提案だけ。対策は人が選ぶまで確定しない)。
  const recommendedLabels = useMemo(
    () => suggestHazardsFor(workLabels, machineNames).map(normalizeName),
    [workLabels, machineNames]
  );
  const isRecommended = (h: MasterHazard) => recommendedLabels.includes(normalizeName(h.label));

  const sorted = useMemo(() => {
    const recommended = masters.hazards.filter((h) => recommendedLabels.includes(normalizeName(h.label)));
    // おすすめの中では、作業内容に由来する順(辞書の順)に並べる
    recommended.sort(
      (a, b) => recommendedLabels.indexOf(normalizeName(a.label)) - recommendedLabels.indexOf(normalizeName(b.label))
    );
    const rest = masters.hazards.filter((h) => !recommendedLabels.includes(normalizeName(h.label)));
    return [...recommended, ...rest];
  }, [masters.hazards, recommendedLabels]);

  function toggle(master: MasterHazard) {
    const existing = ky.find((k) => matchesHazard(k, master));
    if (existing) {
      if (existing.measures.length > 0 && !window.confirm(`「${existing.label}」の対策の選択も消えます。選択を外しますか?`)) return;
      onChange(ky.filter((k) => k.key !== existing.key));
      return;
    }
    // 危険だけを選ぶ。対策は選ばれるまで空のまま(提案を自動で確定しない)。
    onChange([...ky, { key: newKey(), hazardId: master.id, label: master.label, measures: [] }]);
  }

  function setMeasures(key: string, measures: string[]) {
    onChange(ky.map((k) => (k.key === key ? { ...k, measures } : k)));
  }

  function toggleMeasure(entry: QuickKy, measure: string) {
    setMeasures(
      entry.key,
      entry.measures.includes(measure) ? entry.measures.filter((m) => m !== measure) : [...entry.measures, measure]
    );
  }

  function addCustomMeasure(entry: QuickKy) {
    const text = (customMeasure[entry.key] ?? "").trim();
    if (!text) return;
    if (!entry.measures.includes(text)) setMeasures(entry.key, [...entry.measures, text]);
    setCustomMeasure((prev) => ({ ...prev, [entry.key]: "" }));
  }

  function addCustomHazard() {
    const label = customHazard.trim();
    if (!label) return;
    if (!ky.some((k) => normalizeName(k.label) === normalizeName(label))) {
      onChange([...ky, { key: newKey(), hazardId: null, label, measures: [] }]);
    }
    setCustomHazard("");
  }

  const shown = sorted.filter((h) => matchesQuery(h.label, query));

  return (
    <div className="flex flex-col gap-4">
      {recommendedLabels.length > 0 && (
        <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          選んだ作業・機械に関係しそうな危険に「おすすめ」を付けています。提案です。実際の現場に合わせて選んでください。
        </p>
      )}
      <SearchBox value={query} onChange={setQuery} placeholder="危険の内容を探す" />

      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((h) => {
          const selected = ky.some((k) => matchesHazard(k, h));
          return (
            <ChoiceButton
              key={h.id}
              selected={selected}
              tone={isRecommended(h) ? "recommended" : "default"}
              badge={isRecommended(h) ? "おすすめ" : undefined}
              onClick={() => toggle(h)}
            >
              {h.isFavorite && <span className="mr-1 text-amber-400">★</span>}
              {h.label}
            </ChoiceButton>
          );
        })}
        {shown.length === 0 && <p className="col-span-2 py-3 text-center text-sm text-slate-500">見つかりませんでした。</p>}
      </div>

      <div className="flex gap-2">
        <input
          value={customHazard}
          onChange={(e) => setCustomHazard(e.target.value)}
          placeholder="一覧にない危険を入力して追加"
          aria-label="一覧にない危険を入力"
          className={inputClass}
          maxLength={100}
        />
        <button
          type="button"
          onClick={addCustomHazard}
          className="min-h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 active:bg-slate-100"
        >
          追加
        </button>
      </div>

      {ky.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-700">選んだ危険と対策(対策は必ず選んでください)</h3>
          {ky.map((entry) => {
            const master = masters.hazards.find((h) => h.id === entry.hazardId) ?? masters.hazards.find((h) => normalizeName(h.label) === normalizeName(entry.label));
            const candidates = master?.measures ?? [];
            // 候補にない対策(自分で書いたもの)も、選択済みとして並べる
            const extra = entry.measures.filter((m) => !candidates.includes(m));
            return (
              <SelectedCard
                key={entry.key}
                title={entry.label}
                onRemove={() => onChange(ky.filter((k) => k.key !== entry.key))}
                warning={entry.measures.length === 0 ? "対策がまだ選ばれていません。" : null}
              >
                <div className="flex flex-col gap-2">
                  {[...candidates, ...extra].map((measure) => {
                    const on = entry.measures.includes(measure);
                    return (
                      <button
                        key={measure}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleMeasure(entry, measure)}
                        className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-[15px] font-medium ${
                          on ? "border-amber-500 bg-amber-100 text-amber-950" : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <span aria-hidden className="text-lg">{on ? "☑" : "☐"}</span>
                        {measure}
                      </button>
                    );
                  })}
                  <div className="flex gap-2">
                    <input
                      value={customMeasure[entry.key] ?? ""}
                      onChange={(e) => setCustomMeasure((prev) => ({ ...prev, [entry.key]: e.target.value }))}
                      placeholder="対策を自分で書いて追加"
                      aria-label={`${entry.label}の対策を入力`}
                      className={inputClass}
                      maxLength={200}
                    />
                    <button
                      type="button"
                      onClick={() => addCustomMeasure(entry)}
                      className="min-h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 active:bg-slate-100"
                    >
                      追加
                    </button>
                  </div>
                </div>
              </SelectedCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
