"use client";

import { useActionState, useRef } from "react";
import { createKyActivityAction } from "../actions";
import { Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";

export function NewKyForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; label: string }[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createKyActivityAction, undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldLabel label="現場" required>
        <Select name="projectId" required defaultValue={defaultProjectId ?? ""}>
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
          name="activityDate"
          required
          defaultValue={today}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </FieldLabel>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">本日の作業内容</span>
          <VoiceInputButton targetRef={textareaRef} mode="append" />
        </div>
        <Textarea
          ref={textareaRef}
          name="workContent"
          required
          rows={3}
          placeholder="例: バックホウで掘削、型枠設置、ダンプで残土搬出"
        />
        <span className="text-xs text-slate-400">
          作業内容から一般的な危険ポイント・対策の候補を提案します。内容は次の画面で必ず確認・修正してから承認してください。
        </span>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "AIが提案を作成中..." : "危険予知の候補を作成"}
      </Button>
    </form>
  );
}
