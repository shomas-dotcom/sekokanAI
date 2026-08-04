"use client";

import { useActionState } from "react";
import { createQuoteAction } from "../actions";
import { Input, Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { useRef } from "react";

export function NewQuoteForm({ projects }: { projects: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createQuoteAction, undefined);
  const freeTextRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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

      <FieldLabel label="見積名" required>
        <Input name="title" required placeholder="例: 道路築造工事 見積書" />
      </FieldLabel>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">工事内容(自由記述、任意)</span>
          <VoiceInputButton targetRef={freeTextRef} mode="append" />
        </div>
        <Textarea
          ref={freeTextRef}
          name="freeText"
          rows={4}
          placeholder={"例:\n掘削工\n残土処分\nL型側溝設置"}
        />
        <span className="text-xs text-slate-400">
          改行区切りでAIが見積項目の下書きを作成します(単価は未設定・要確認)。マイクボタンで音声入力もできます。
        </span>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "作成中..." : "見積を作成"}
      </Button>
    </form>
  );
}
