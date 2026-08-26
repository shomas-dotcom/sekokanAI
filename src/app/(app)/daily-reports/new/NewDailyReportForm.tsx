"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { createDailyReportAction } from "../actions";
import { Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { LocationWeatherButton } from "@/components/LocationWeatherButton";

type ProjectOption = { id: string; name: string; customerName: string };

export function NewDailyReportForm({
  projects,
  workItemLabels,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  workItemLabels: string[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createDailyReportAction, undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const today = new Date().toISOString().slice(0, 10);

  // 取引先名は工事名(案件)に紐づくCustomerマスタから取得する(重複入力を避けるため
  // DailyReportに独立フィールドは持たず、選択した案件の取引先を読み取り専用で表示する)
  const selectedCustomerName = useMemo(
    () => projects.find((p) => p.id === projectId)?.customerName ?? null,
    [projects, projectId]
  );

  function appendWorkItem(label: string) {
    const el = textareaRef.current;
    if (!el) return;
    const existing = el.value.trim();
    el.value = existing ? `${existing}、${label}` : label;
    setHasText(el.value.trim().length > 0);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FieldLabel label="案件(工事名)" required>
        <Select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="" disabled>
            選択してください
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.customerName} / {p.name}
            </option>
          ))}
        </Select>
      </FieldLabel>

      {selectedCustomerName && (
        <p className="-mt-3 text-sm text-slate-500">取引先: {selectedCustomerName}</p>
      )}

      <FieldLabel label="日付" required>
        <input
          type="date"
          name="reportDate"
          required
          defaultValue={today}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </FieldLabel>

      <LocationWeatherButton />

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-6">
        <VoiceInputButton
          targetRef={textareaRef}
          continuous
          size="lg"
          onTranscript={(t) => setHasText(t.trim().length > 0)}
        />
        <p className="text-center text-sm text-slate-600">
          マイクをタップして、現場の状況を話してください
          <br />
          <span className="text-xs text-slate-400">
            例:「今日の現場は坂戸市役所。作業内容はL型側溝据付20m。4トンダンプ1台。0.25BH使用。作業員4名。天候晴れ。
            職長は田中。8時開始。17時終了。危険箇所は重機接触。翌日は型枠施工。異常なし。」
          </span>
        </p>
      </div>

      {workItemLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {workItemLabels.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => appendWorkItem(label)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
            >
              + {label}
            </button>
          ))}
        </div>
      )}

      <FieldLabel label="音声認識結果(自由に編集できます)">
        <Textarea
          ref={textareaRef}
          name="rawVoiceInput"
          rows={5}
          onChange={(e) => setHasText(e.target.value.trim().length > 0)}
          placeholder="マイクボタンで話すか、直接入力してください"
        />
      </FieldLabel>

      <p className="text-xs text-slate-400">
        職長・使用車両・使用材料・協力会社・開始/終了時間・危険予知・翌日の予定・備考・写真は、
        作成後の詳細画面で確認・追加入力できます。
      </p>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "AIが整理中..." : hasText ? "AIで整理して日報を作成" : "日報を作成"}
      </Button>
    </form>
  );
}
