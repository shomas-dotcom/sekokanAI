"use client";

import type { ReactNode } from "react";

// 日報かんたん入力で使う、スマホ(特にiPhone)で押しやすい部品。
// - ボタンは高さ48px以上(片手で押しやすい大きさ)
// - 選んだ状態は、色の変化とチェックマークの両方で分かるようにする
// - 入力欄は16px以上(iPhoneは15px以下だと入力時に画面が勝手に拡大されるため)

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

export function ChoiceButton({
  selected,
  onClick,
  children,
  badge,
  tone = "default",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: string;
  tone?: "default" | "recommended";
}) {
  const base =
    "relative flex min-h-14 w-full items-center justify-center rounded-2xl border-2 px-3 py-3 text-center text-[15px] font-semibold leading-snug transition active:scale-[0.98]";
  const state = selected
    ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30"
    : tone === "recommended"
      ? "border-dashed border-indigo-300 bg-indigo-50 text-indigo-800 hover:border-indigo-400"
      : "border-slate-200 bg-white text-slate-700 hover:border-amber-300";
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`${base} ${state}`}>
      {selected && <span className="absolute left-2 top-1.5 text-sm">✓</span>}
      {badge && !selected && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium leading-none text-white">
          {badge}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label}を減らす`}
        onClick={() => onChange(clamp(value - step))}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-bold text-slate-700 active:bg-slate-100"
      >
        −
      </button>
      <span className="min-w-12 text-center text-lg font-semibold tabular-nums text-slate-900">{value}</span>
      <button
        type="button"
        aria-label={`${label}を増やす`}
        onClick={() => onChange(clamp(value + step))}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-bold text-slate-700 active:bg-slate-100"
      >
        ＋
      </button>
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "名前で探す",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={inputClass}
    />
  );
}

export function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function SelectedCard({
  title,
  onRemove,
  children,
  warning,
}: {
  title: ReactNode;
  onRemove: () => void;
  children: ReactNode;
  warning?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-rose-600 active:bg-rose-50"
        >
          削除
        </button>
      </div>
      {children}
      {warning && <p className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs text-amber-900">{warning}</p>}
    </div>
  );
}

export function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().normalize("NFKC").toLowerCase();
  if (!q) return true;
  return text.normalize("NFKC").toLowerCase().includes(q);
}

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `c${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
