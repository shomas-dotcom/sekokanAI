"use client";

import { useActionState, useRef, useState } from "react";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { Button, Textarea } from "@/components/ui";

export type VoiceFillState<T> = { error?: string; extraction?: T } | undefined;

/**
 * 「まとめて音声入力する」共通コンポーネント。話した内容をAIに項目分解させ、
 * onExtractedで親コンポーネントへ渡す(そのままDB保存はしない。既存のフォームへ
 * 仮入力するだけで、登録は必ず人間がフォームを確認して送信する)。
 */
export function VoiceFormFiller<T>({
  action,
  onExtracted,
  placeholder,
}: {
  action: (state: VoiceFillState<T>, formData: FormData) => Promise<VoiceFillState<T>>;
  onExtracted: (extraction: T) => void;
  placeholder?: string;
}) {
  const [state, formAction, pending] = useActionState<VoiceFillState<T>, FormData>(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result?.extraction) onExtracted(result.extraction);
      return result;
    },
    undefined
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasText, setHasText] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4"
    >
      <p className="text-sm font-semibold text-slate-700">まとめて音声入力する</p>
      <div className="flex items-center gap-3">
        <VoiceInputButton
          targetRef={textareaRef}
          continuous
          size="lg"
          onTranscript={(t) => setHasText(t.trim().length > 0)}
        />
        <p className="text-xs text-slate-500">
          マイクを押して{placeholder ?? "内容"}をまとめて話してください
        </p>
      </div>
      <Textarea
        ref={textareaRef}
        name="transcript"
        rows={3}
        onChange={(e) => setHasText(e.target.value.trim().length > 0)}
        placeholder="マイクで話すか、直接入力してください"
      />
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending || !hasText}>
        {pending ? "読み取っています..." : "この内容を入力欄に反映する"}
      </Button>
    </form>
  );
}
