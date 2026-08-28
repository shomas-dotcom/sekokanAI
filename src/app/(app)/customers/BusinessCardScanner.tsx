"use client";

import { useActionState, useRef } from "react";
import { scanBusinessCardAction, type BusinessCardScanState } from "./actions";
import type { BusinessCardExtraction } from "@/lib/ai";
import Link from "next/link";

/**
 * 「名刺を撮影」「画像を選択」の2ボタン。読み取り結果は保存せず、親コンポーネントへ
 * 渡して入力フォームへ仮入力させる(登録は必ずユーザーが確認画面で行う)。
 */
export function BusinessCardScanner({
  onExtracted,
}: {
  onExtracted: (extraction: BusinessCardExtraction) => void;
}) {
  const [state, formAction, pending] = useActionState<BusinessCardScanState, FormData>(
    async (prevState, formData) => {
      const result = await scanBusinessCardAction(prevState, formData);
      if (result?.extraction) onExtracted(result.extraction);
      return result;
    },
    undefined
  );
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(input: HTMLInputElement | null) {
    if (!input?.files?.[0] || !formRef.current) return;
    formRef.current.requestSubmit();
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-700">名刺から自動で入力する</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25"
          >
            📷 名刺を撮影
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
          >
            画像を選択
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => submit(e.target)}
          />
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => submit(e.target)}
          />
        </div>

        {pending && <p className="text-sm text-indigo-700">名刺を読み取っています...</p>}

        {state?.error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <p>{state.error}</p>
            <p className="mt-1 text-xs">
              再度撮影し直すか、別の画像を選び直してください。うまくいかない場合は下のフォームに直接入力してください。
            </p>
          </div>
        )}

        {state?.extraction && (
          <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            {state.extraction.confidence === "needs_review" && (
              <p className="mb-1 font-medium text-amber-700">
                ⚠ 一部の項目しか読み取れませんでした。下のフォームで内容を確認してください。
              </p>
            )}
            {state.extraction.confidence === "high" && (
              <p className="mb-1 font-medium text-emerald-700">
                読み取りました。念のため下のフォームで内容を確認してください。
              </p>
            )}
            {state.duplicates.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                <p className="font-medium">⚠ 既存顧客の可能性があります</p>
                <ul className="mt-1 list-inside list-disc">
                  {state.duplicates.map((d) => (
                    <li key={d.id}>
                      <Link href={`/customers/${d.id}`} className="underline" target="_blank">
                        {d.name}
                      </Link>
                      {d.phone && <span className="text-xs"> ({d.phone})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
