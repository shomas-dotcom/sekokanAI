"use client";

import { useActionState, useRef } from "react";
import { submitAiIntakeAction, type AiIntakeSubmitState } from "./actions";

/**
 * ダッシュボード最上部の「AIかんたん登録」。写真・書類(名刺・見積書・PDF等)を
 * 撮影/添付すると、内容の判定・仕分けはAIに任せる(顧客登録・案件登録・
 * 見積作成のどれかを最初に選ばせない)。解析結果はDBに直接確定せず、
 * 一度 /ai-inbox/[id] の確認画面に遷移してから登録する。
 *
 * 話す・書くだけで登録したい場合は、ダッシュボードの「AIに話す」を使う
 * (2026-09: 従来ここにあった「文面」「音声」ボタンは、より多くの種類
 * (日報・KY・見積・請求等)を判定できる「AIに話す」に一本化し、この
 * ウィジェットは写真・書類の読み取りに絞ってシンプルにした)。
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
  const formRef = useRef<HTMLFormElement>(null);

  function submitFile(input: HTMLInputElement | null) {
    if (!input?.files?.[0] || !formRef.current) return;
    formRef.current.requestSubmit();
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">AIかんたん登録</h2>
      <p className="mt-1 text-sm text-slate-600">名刺・見積書・PDF等を撮影/添付すると、AIが自動入力します</p>

      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
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

        {pending && <p className="text-sm text-indigo-700">AIが判定しています...</p>}
        {state?.error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
        )}
      </form>
    </div>
  );
}
