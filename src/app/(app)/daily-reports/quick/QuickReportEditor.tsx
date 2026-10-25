"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { analyzeQuickVoiceAction, saveQuickDailyReportAction, type QuickVoiceState } from "../quickActions";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { LocationWeatherButton } from "@/components/LocationWeatherButton";
import type { QuickMasterData } from "@/lib/dailyReport/masters";
import {
  laborAmount,
  machineAmount,
  totalHeadcount,
  totalManDays,
  type QuickState,
} from "@/lib/dailyReport/quickInput";
import { LABOR_CATEGORY_LABEL } from "@/lib/dailyReport/standardMasters";
import { WorkTab } from "./WorkTab";
import { MachineTab } from "./MachineTab";
import { LaborTab, priceFor } from "./LaborTab";
import { KyTab } from "./KyTab";
import { draftKey, useQuickDraft } from "./useQuickDraft";
import { inputClass, yen } from "./parts";

type TabId = "work" | "machine" | "labor" | "ky";

const TABS: { id: TabId; label: string }[] = [
  { id: "work", label: "作業内容" },
  { id: "machine", label: "使用機械" },
  { id: "labor", label: "労務" },
  { id: "ky", label: "KY" },
];

export type QuickProjectOption = { id: string; name: string; customerName: string };

export type QuickEditorInitial = {
  projectId: string;
  reportDate: string;
  weather: string;
  memo: string;
  nextDayPlan: string;
  state: QuickState;
};

export function QuickReportEditor({
  mode,
  reportId,
  projects,
  lockedProjectLabel,
  masters,
  initial,
  legacyNotice,
}: {
  mode: "create" | "edit";
  reportId?: string;
  projects: QuickProjectOption[];
  /** 修正のときは案件を変えられないので、名前だけ見せる。 */
  lockedProjectLabel?: string;
  masters: QuickMasterData;
  initial: QuickEditorInitial;
  /** かんたん入力を使っていない古い日報を直すときの案内。 */
  legacyNotice?: boolean;
}) {
  const [formState, formAction, pending] = useActionState(saveQuickDailyReportAction, undefined);
  const [state, setState] = useState<QuickState>(initial.state);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [reportDate, setReportDate] = useState(initial.reportDate);
  const [weather, setWeather] = useState(initial.weather);
  const [nextDayPlan, setNextDayPlan] = useState(initial.nextDayPlan);
  const [memo, setMemo] = useState(initial.memo);
  const [tab, setTab] = useState<TabId>("work");
  const [voiceResult, setVoiceResult] = useState<QuickVoiceState | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const hasContent =
    state.works.length + state.machines.length + state.labor.length + state.ky.length > 0 || memo.trim().length > 0;
  const { saved, discard, dismiss } = useQuickDraft(
    draftKey(mode, reportId),
    { projectId, reportDate, weather, memo, nextDayPlan, state },
    hasContent
  );

  const selectedProject = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const workLabels = state.works.map((w) => w.label);
  const machineNames = state.machines.map((m) => m.name);

  function restoreDraft() {
    if (!saved) return;
    setState(saved.state);
    setProjectId(saved.projectId || projectId);
    setReportDate(saved.reportDate || reportDate);
    setWeather(saved.weather);
    setNextDayPlan(saved.nextDayPlan);
    setMemo(saved.memo);
    if (memoRef.current) memoRef.current.value = saved.memo;
    dismiss();
  }

  function analyzeVoice() {
    const text = memoRef.current?.value ?? memo;
    startAnalyze(async () => {
      const result = await analyzeQuickVoiceAction(text, JSON.stringify(state));
      if (result.state) setState(result.state);
      if (result.nextDayPlan && !nextDayPlan.trim()) setNextDayPlan(result.nextDayPlan);
      setVoiceResult(result);
    });
  }

  function goTo(next: TabId) {
    setTab(next);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 概算(管理者だけ)。単価が未登録のものは含めず、件数で知らせる。
  const machineAmounts = state.machines.map((m) => {
    const master = masters.machines.find((x) => x.id === m.machineId);
    return machineAmount(m.quantity, m.usageValue, master?.unitPrice ?? null);
  });
  const laborAmounts = state.labor.map((l) => laborAmount(l.headcount, l.manDays, priceFor(l, masters)));
  const sum = (values: (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);
  const missing = (values: (number | null)[]) => values.filter((v) => v == null).length;

  const counts: Record<TabId, number> = {
    work: state.works.length,
    machine: state.machines.length,
    labor: state.labor.length,
    ky: state.ky.length,
  };

  return (
    <form
      action={formAction}
      className="flex max-w-xl flex-col gap-5 pb-44"
      // 入力欄でEnter(iPhoneの「開く/実行」)を押しても、日報が途中で保存されないようにする。
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      {mode === "edit" && reportId && <input type="hidden" name="id" value={reportId} />}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="payload" value={JSON.stringify(state)} />

      {saved && (
        <div className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-900">
          <p className="font-semibold">入力の途中だった内容が、この端末に残っています。</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="min-h-11 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white active:bg-sky-700"
            >
              続きから入力する
            </button>
            <button
              type="button"
              onClick={discard}
              className="min-h-11 rounded-xl border border-sky-300 bg-white px-4 text-sm font-semibold text-sky-800 active:bg-sky-100"
            >
              破棄する
            </button>
          </div>
        </div>
      )}

      {legacyNotice && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
          この日報は、従来の入力で作られています。必要な項目だけ下で選び直してください。選ばなかった項目の文章は消えません。
        </p>
      )}

      {/* 基本情報 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {mode === "create" ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            案件(工事名)<span className="sr-only">必須</span>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                選択してください
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.customerName} / {p.name}
                </option>
              ))}
            </select>
            {selectedProject && <span className="text-xs text-slate-500">取引先: {selectedProject.customerName}</span>}
          </label>
        ) : (
          <p className="text-sm text-slate-600">
            案件: <span className="font-semibold text-slate-900">{lockedProjectLabel}</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            {mode === "edit" ? "日付(直せます)" : "日付"}
            <input
              type="date"
              name="reportDate"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            天候
            <input
              name="weather"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="例: 晴れ"
              className={inputClass}
              maxLength={50}
            />
          </label>
        </div>
        {mode === "create" && <LocationWeatherButton />}
        {mode === "edit" && (
          <p className="text-xs text-slate-500">
            日付を変えると、この日報から作られた勤怠・出面・機械の経費も同じ日に動きます。承認や締めが済んでいるものがあるときは、日付は変わらず、理由をお知らせします。
          </p>
        )}
      </section>

      {/* 音声入力 */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5">
        <VoiceInputButton
          targetRef={memoRef}
          continuous
          size="lg"
          onTranscript={(t) => setMemo(t)}
        />
        <p className="text-center text-sm text-slate-600">
          マイクを押して、現場の状況を話してください
          <br />
          <span className="text-xs text-slate-400">
            例:「汚水管を20m布設。作業員3名。0.25バックホウ1台と4tダンプ1台使用。危険箇所は重機との接触。」
          </span>
        </p>
        <textarea
          ref={memoRef}
          name="memo"
          rows={4}
          defaultValue={initial.memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="話した内容や、メモ(自由に直せます)"
          aria-label="音声認識結果・メモ"
          className={`${inputClass} w-full`}
        />
        <button
          type="button"
          onClick={analyzeVoice}
          disabled={analyzing || memo.trim().length === 0}
          className="min-h-12 w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 text-[15px] font-semibold text-white shadow-sm disabled:opacity-40 active:opacity-90"
        >
          {analyzing ? "読み取っています…" : "話した内容を、下の選択に反映する"}
        </button>
        {voiceResult?.error && <p className="w-full rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{voiceResult.error}</p>}
        {voiceResult && !voiceResult.error && (
          <div className="flex w-full flex-col gap-1.5 rounded-xl bg-white p-3 text-sm text-slate-700">
            {voiceResult.added && voiceResult.added.length > 0 ? (
              <>
                <p className="font-semibold text-slate-900">次を追加しました(合っているか確認してください)</p>
                <ul className="list-inside list-disc">
                  {voiceResult.added.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>新しく追加するものは見つかりませんでした。</p>
            )}
            {voiceResult.skipped && voiceResult.skipped.length > 0 && (
              <p className="text-xs text-slate-500">すでに選んであるため、重ねて追加しなかったもの: {voiceResult.skipped.join("、")}</p>
            )}
            {voiceResult.unclear && voiceResult.unclear.length > 0 && (
              <ul className="list-inside list-disc rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                {voiceResult.unclear.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 4つのタブ */}
      <div ref={tabsRef} className="scroll-mt-28 flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="入力する項目">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-1 text-sm font-bold leading-tight transition ${
                tab === t.id
                  ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {t.label}
              {counts[t.id] > 0 && (
                <span
                  className={`mt-0.5 rounded-full px-2 text-xs ${
                    tab === t.id ? "bg-white/90 text-amber-700" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div hidden={tab !== "work"}>
            <WorkTab masters={masters} works={state.works} onChange={(works) => setState((s) => ({ ...s, works }))} />
          </div>
          <div hidden={tab !== "machine"}>
            <MachineTab
              masters={masters}
              machines={state.machines}
              workLabels={workLabels}
              onChange={(machines) => setState((s) => ({ ...s, machines }))}
            />
          </div>
          <div hidden={tab !== "labor"}>
            <LaborTab
              masters={masters}
              labor={state.labor}
              machines={state.machines}
              workLabels={workLabels}
              onChange={(labor) => setState((s) => ({ ...s, labor }))}
            />
          </div>
          <div hidden={tab !== "ky"}>
            <KyTab
              masters={masters}
              ky={state.ky}
              workLabels={workLabels}
              machineNames={machineNames}
              onChange={(ky) => setState((s) => ({ ...s, ky }))}
            />
          </div>
        </section>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        翌日の予定
        <textarea
          name="nextDayPlan"
          rows={2}
          value={nextDayPlan}
          onChange={(e) => setNextDayPlan(e.target.value)}
          className={inputClass}
          maxLength={500}
        />
      </label>

      {/* 選択内容のまとめ */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="選択内容のまとめ">
        <h2 className="text-base font-bold text-slate-900">選択内容のまとめ</h2>

        <SummaryGroup title="作業内容" empty="まだ選んでいません" onEdit={() => goTo("work")}>
          {state.works.map((w) => (
            <SummaryRow
              key={w.key}
              onRemove={() => setState((s) => ({ ...s, works: s.works.filter((x) => x.key !== w.key) }))}
            >
              {w.label}
              {w.quantity != null && ` ${w.quantity}${w.unit ?? ""}`}
              {w.workMinutes != null && `(${Math.round((w.workMinutes / 60) * 100) / 100}時間)`}
            </SummaryRow>
          ))}
        </SummaryGroup>

        <SummaryGroup title="使用機械" empty="まだ選んでいません" onEdit={() => goTo("machine")}>
          {state.machines.map((m, i) => (
            <SummaryRow
              key={m.key}
              onRemove={() => setState((s) => ({ ...s, machines: s.machines.filter((x) => x.key !== m.key) }))}
            >
              {m.name} {m.quantity}台{m.ownership === "RENTAL" ? "(レンタル)" : ""}
              {masters.canSeeCosts && (
                <span className="ml-1 text-slate-500">
                  {machineAmounts[i] != null ? `・${yen(machineAmounts[i] as number)}` : "・単価未登録"}
                </span>
              )}
            </SummaryRow>
          ))}
        </SummaryGroup>

        <SummaryGroup title="労務" empty="まだ入っていません" onEdit={() => goTo("labor")}>
          {state.labor.map((l, i) => (
            <SummaryRow
              key={l.key}
              onRemove={() => setState((s) => ({ ...s, labor: s.labor.filter((x) => x.key !== l.key) }))}
            >
              {l.workerName || (l.category ? LABOR_CATEGORY_LABEL[l.category] : "区分未選択")}
              {!l.workerName && l.headcount > 1 ? ` ${l.headcount}名` : ""} ・ {Math.round(l.headcount * l.manDays * 100) / 100}人工
              {masters.canSeeCosts && (
                <span className="ml-1 text-slate-500">
                  {laborAmounts[i] != null ? `・${yen(laborAmounts[i] as number)}` : "・単価未登録"}
                </span>
              )}
            </SummaryRow>
          ))}
          {state.labor.length > 0 && (
            <li className="list-none text-xs font-medium text-slate-600">
              合計 {totalHeadcount(state.labor)}名 / {totalManDays(state.labor)}人工
            </li>
          )}
        </SummaryGroup>

        <SummaryGroup title="KY(危険予知)" empty="まだ選んでいません" onEdit={() => goTo("ky")}>
          {state.ky.map((k) => (
            <SummaryRow key={k.key} onRemove={() => setState((s) => ({ ...s, ky: s.ky.filter((x) => x.key !== k.key) }))}>
              {k.label}
              <span className="ml-1 text-slate-500">
                {k.measures.length > 0 ? `(対策 ${k.measures.length}件)` : "(対策が未選択)"}
              </span>
            </SummaryRow>
          ))}
        </SummaryGroup>

        {masters.canSeeCosts && (
          <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-800">
            原価の目安(管理者だけに表示): 労務費 {yen(sum(laborAmounts))} + 機械費 {yen(sum(machineAmounts))} ={" "}
            <span className="font-semibold">{yen(sum(laborAmounts) + sum(machineAmounts))}</span>
            {missing(laborAmounts) + missing(machineAmounts) > 0 && (
              <span className="block text-xs text-amber-700">
                単価が未登録の行が{missing(laborAmounts) + missing(machineAmounts)}件あります(その行は金額に含めていません)。
              </span>
            )}
          </p>
        )}
      </section>

      {/* 画面の下に固定: タブの切り替えと保存 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {formState?.error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formState.error}
            </p>
          )}
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-medium text-slate-600">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => goTo(t.id)}
                className="min-h-10 rounded-lg bg-slate-100 px-1 active:bg-slate-200"
              >
                {t.label}
                <span className="ml-1 font-bold text-amber-700">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-14 w-full rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 text-base font-bold text-white shadow-md shadow-orange-600/30 disabled:opacity-50 active:opacity-90"
          >
            {pending ? "保存しています…" : mode === "edit" ? "この内容で日報を保存する" : "日報を保存する"}
          </button>
        </div>
      </div>
    </form>
  );
}

function SummaryGroup({
  title,
  empty,
  onEdit,
  children,
}: {
  title: string;
  empty: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.some((c) => (Array.isArray(c) ? c.length > 0 : Boolean(c))) : Boolean(children);
  return (
    <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2.5 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <button type="button" onClick={onEdit} className="min-h-10 rounded-lg px-3 text-sm font-medium text-amber-700 active:bg-amber-50">
          直す
        </button>
      </div>
      {hasChildren ? <ul className="flex flex-col gap-1">{children}</ul> : <p className="text-sm text-slate-400">{empty}</p>}
    </div>
  );
}

function SummaryRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-800">
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="この項目を外す"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 active:bg-rose-50 active:text-rose-600"
      >
        ✕
      </button>
    </li>
  );
}
