"use client";

import { useActionState, useRef, useState } from "react";
import { createDailyReportAction } from "../actions";
import { Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";

export function NewDailyReportForm({ projects }: { projects: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createDailyReportAction, undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FieldLabel label="案件" required>
        <Select name="projectId" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="日付" required>
        <input
          type="date"
          name="reportDate"
          required
          defaultValue={today}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
      </FieldLabel>

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
            例:「今日の現場は坂戸市役所。作業内容はL型側溝据付20m。4トンダンプ1台。0.25BH使用。作業員4名。天候晴れ。異常なし。」
          </span>
        </p>
      </div>

      <FieldLabel label="音声認識結果(自由に編集できます)">
        <Textarea
          ref={textareaRef}
          name="rawVoiceInput"
          rows={5}
          onChange={(e) => setHasText(e.target.value.trim().length > 0)}
          placeholder="マイクボタンで話すか、直接入力してください"
        />
      </FieldLabel>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "AIが整理中..." : hasText ? "AIで整理して日報を作成" : "日報を作成"}
      </Button>
    </form>
  );
}
