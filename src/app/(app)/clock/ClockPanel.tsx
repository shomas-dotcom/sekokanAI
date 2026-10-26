"use client";

import { useActionState, useEffect, useState } from "react";
import { Select } from "@/components/ui";
import { clockAction } from "./actions";

type Project = { id: string; name: string };

function formatNow(date: Date) {
  return date.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * 出勤・退勤の2つのボタンだけの打刻画面。現場は「今の案件」から選ぶ(前回の現場が最初から選ばれている)。
 * 表示中の時計は目安で、記録される時刻はサーバーが押した瞬間の時刻を使う。
 */
export function ClockPanel({
  projects,
  defaultProjectId,
  canClockIn,
  canClockOut,
}: {
  projects: Project[];
  defaultProjectId: string;
  canClockIn: boolean;
  canClockOut: boolean;
}) {
  const [state, formAction, pending] = useActionState(clockAction, undefined);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* サーバーで描いた時刻と画面を開いた時刻は数秒ずれるため、その差の警告は出さない */}
      <p suppressHydrationWarning className="text-center text-5xl font-bold tabular-nums tracking-tight text-slate-900">
        {formatNow(now)}
      </p>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        現場
        <Select name="projectId" defaultValue={defaultProjectId} disabled={!canClockIn}>
          {projects.length === 0 && <option value="">選べる案件がありません</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="submit"
          name="kind"
          value="in"
          disabled={pending || !canClockIn || projects.length === 0}
          className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 py-8 text-2xl font-bold text-white shadow-sm shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-40"
        >
          出勤
        </button>
        <button
          type="submit"
          name="kind"
          value="out"
          disabled={pending || !canClockOut}
          className="rounded-2xl bg-slate-800 py-8 text-2xl font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40"
        >
          退勤
        </button>
      </div>

      {pending && <p className="text-center text-sm text-slate-500">記録しています...</p>}
      {state && !pending && (
        <p
          role="status"
          className={
            state.ok
              ? "rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800"
              : "rounded-xl bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-700"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
