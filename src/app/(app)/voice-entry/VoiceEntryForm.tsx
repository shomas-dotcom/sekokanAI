"use client";

import { useActionState, useRef, useState } from "react";
import { submitVoiceEntryAction } from "./actions";
import { Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";

type ProjectOption = { id: string; name: string; customerName: string };

/**
 * ベテラン・年配の方でも迷わないよう、選択肢をできる限り減らした音声入力フォーム。
 * 「日報」か「KY」かは選ばせず、話した内容から自動で振り分ける(actions.ts参照)。
 * ボタン・文字を大きくし、手順は「現場を選ぶ→マイクで話す→送信する」の3つだけにする。
 */
export function VoiceEntryForm({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(submitVoiceEntryAction, undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? (projects.length === 1 ? projects[0].id : ""));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldLabel label="① 現場を選ぶ" required>
        <Select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="text-lg py-4"
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

      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-8">
        <p className="text-base font-semibold text-slate-700">② マイクを押して話す</p>
        <VoiceInputButton
          targetRef={textareaRef}
          continuous
          size="xl"
          onTranscript={(t) => setHasText(t.trim().length > 0)}
        />
        <p className="text-center text-sm text-slate-600">
          今日の作業の様子や、気をつけることを、そのまま話してください
          <br />
          <span className="text-xs text-slate-400">
            例:「今日は坂戸市役所の現場。作業員4名。バックホウで掘削。8時開始、17時終了。」
          </span>
        </p>
      </div>

      <FieldLabel label="話した内容(間違っていたら書き直せます)">
        <Textarea
          ref={textareaRef}
          name="transcript"
          rows={5}
          className="text-base"
          onChange={(e) => setHasText(e.target.value.trim().length > 0)}
          placeholder="マイクで話すか、直接入力してください"
        />
      </FieldLabel>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !hasText} className="py-4 text-lg">
        {pending ? "AIが振り分け中..." : "③ 送信する"}
      </Button>
    </form>
  );
}
