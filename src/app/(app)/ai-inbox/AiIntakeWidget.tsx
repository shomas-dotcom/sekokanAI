"use client";

import { useActionState, useRef, useState } from "react";
import { submitAiIntakeAction, type AiIntakeSubmitState } from "./actions";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { Textarea } from "@/components/ui";

/**
 * ダッシュボード最上部の「AIかんたん登録」。撮影・ファイル・文面・音声の
 * どれで入力しても、内容の判定・仕分けはAIに任せる(顧客登録・案件登録・
 * 見積作成のどれかを最初に選ばせない)。解析結果はDBに直接確定せず、
 * 一度 /ai-inbox/[id] の確認画面に遷移してから登録する。
 */
export function AiIntakeWidget() {
  const [state, formAction, pending] = useActionState<AiIntakeSubmitState, FormData>(
    async (prevState, formData) => {
      const result = await submitAiIntakeAction(prevState, formData);
      return result;
    },
    undefined
  );
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showText, setShowText] = useState(false);
  const [hasText, setHasText] = useState(false);

  function submitFile(input: HTMLInputElement | null) {
    if (!input?.files?.[0] || !formRef.current) return;
    formRef.current.requestSubmit();
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">AIかんたん登録</h2>
      <p className="mt-1 text-sm text-slate-600">
        写真・名刺・見積書・PDF・LINE文面・音声からAIが自動入力します
      </p>

      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-3xl">📷</span>撮影
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-3xl">📎</span>ファイル
          </button>
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-3xl">💬</span>文面
          </button>
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-3xl">🎤</span>音声
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => submitFile(e.target)}
        />
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => submitFile(e.target)}
        />

        {showText && (
          <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <VoiceInputButton
                targetRef={textareaRef}
                continuous
                onTranscript={(t) => setHasText(t.trim().length > 0)}
              />
              <p className="text-xs text-slate-500">マイクで話すか、LINE・メールの文面を貼り付けてください</p>
            </div>
            <Textarea
              ref={textareaRef}
              name="text"
              rows={4}
              onChange={(e) => setHasText(e.target.value.trim().length > 0)}
              placeholder={"例:\nお世話になります。○○株式会社の佐藤です。\n所沢市○○町の外構工事お願いできますでしょうか。\n土間40㎡、残土10m3。9/10頃施工希望です。\n連絡先090-xxxx-xxxx"}
            />
            <button
              type="submit"
              disabled={pending || !hasText}
              className="w-fit rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {pending ? "AIが判定中..." : "この内容をAIで登録する"}
            </button>
          </div>
        )}

        {pending && !showText && <p className="text-sm text-indigo-700">AIが判定しています...</p>}
        {state?.error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
        )}
      </form>
    </div>
  );
}
