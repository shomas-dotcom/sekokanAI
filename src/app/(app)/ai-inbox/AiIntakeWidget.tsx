"use client";

import { useActionState, useRef } from "react";
import { submitAiIntakeAction, type AiIntakeSubmitState } from "./actions";

/**
 * 「AIかんたん登録」の撮影/ファイルボタン。写真・書類(名刺・見積書・PDF等)を
 * 撮影/添付すると、内容の判定・仕分けはAIに任せる(顧客登録・案件登録・
 * 見積作成のどれかを最初に選ばせない)。解析結果はDBに直接確定せず、
 * 一度 /ai-inbox/[id] の確認画面に遷移してから登録する。
 *
 * 見た目のカード枠は持たず、呼び出し側(ダッシュボードのAIヒーロー領域)に
 * 埋め込んで使う想定(2026-09: 「AIに話す」ボタンと同じ枠にまとめて目立たせた)。
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
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 p-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          <span className="text-2xl">📷</span>撮影
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-2xl bg-white/15 p-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          <span className="text-2xl">📎</span>ファイル
        </button>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        name="cameraFile"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => submitFile(e.target)}
      />
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={(e) => submitFile(e.target)}
      />

      {pending && <p className="text-sm text-white/90">AIが判定しています...</p>}
      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
    </form>
  );
}
