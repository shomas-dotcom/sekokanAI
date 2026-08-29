"use client";

import { useActionState, useRef } from "react";
import { scanIdCardAction, type IdCardScanState } from "./actions";
import type { IdCardExtraction } from "@/lib/ai";

/**
 * 「身分証を撮影」「ファイルを選択」の2ボタン。画像そのものはサーバー側でも
 * 保存しない(scanIdCardAction参照)。氏名・フリガナ・免許の種類/有効期限だけを
 * 登録フォームへ仮入力し、生年月日・住所・免許証番号はこの場で一度だけ表示する
 * (登録が必要ならご自身で控えてください、という位置づけ)。
 */
export function IdCardScanner({
  onExtracted,
}: {
  onExtracted: (extraction: IdCardExtraction) => void;
}) {
  const [state, formAction, pending] = useActionState<IdCardScanState, FormData>(
    async (prevState, formData) => {
      const result = await scanIdCardAction(prevState, formData);
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
        <p className="text-sm font-semibold text-slate-700">身分証から自動で入力する</p>
        <p className="text-xs text-slate-500">
          運転免許証・マイナンバーカード等。画像は保存せず、読み取り後すぐに破棄します。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25"
          >
            📷 身分証を撮影
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
          >
            ファイルを選択
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => submit(e.target)}
          />
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => submit(e.target)}
          />
        </div>

        {pending && <p className="text-sm text-indigo-700">身分証を読み取っています...</p>}

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
                読み取りました。氏名・免許情報を下のフォームに反映しています。
              </p>
            )}
            {(state.extraction.dateOfBirth || state.extraction.address || state.extraction.licenseNumber) && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <p className="font-medium text-slate-600">
                  以下は確認のためこの画面にのみ表示し、保存はしません:
                </p>
                {state.extraction.dateOfBirth && <p>生年月日: {state.extraction.dateOfBirth}</p>}
                {state.extraction.address && <p>住所: {state.extraction.address}</p>}
                {state.extraction.licenseNumber && <p>免許証番号: {state.extraction.licenseNumber}</p>}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
