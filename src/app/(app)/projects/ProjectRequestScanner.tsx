"use client";

import { useActionState, useRef, useState } from "react";
import { scanProjectRequestAction, type ProjectRequestScanState } from "./actions";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { Textarea } from "@/components/ui";
import type { ProjectRequestExtraction } from "@/lib/ai";

/**
 * 見積依頼(写真・PDF・コピペ・音声)を読み取り、案件登録フォームへ仮入力する。
 * OCR→AI項目判定→仮入力→ユーザー確認→登録、の流れを徹底し、ここではDBへの
 * 保存は一切行わない。
 */
export function ProjectRequestScanner({
  onExtracted,
  initialTranscript,
}: {
  onExtracted: (extraction: ProjectRequestExtraction, matchedCustomerId: string | null) => void;
  /** ダッシュボードの音声入力で顧客が一致しなかった場合、読み取り済みの文章を引き継いで表示する */
  initialTranscript?: string;
}) {
  const [state, formAction, pending] = useActionState<ProjectRequestScanState, FormData>(
    async (prevState, formData) => {
      const result = await scanProjectRequestAction(prevState, formData);
      if (result?.extraction) onExtracted(result.extraction, result.matchedCustomerId);
      return result;
    },
    undefined
  );
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [hasText, setHasText] = useState(Boolean(initialTranscript?.trim()));

  function submitFile(input: HTMLInputElement | null) {
    if (!input?.files?.[0] || !formRef.current) return;
    formRef.current.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
      <p className="text-sm font-semibold text-slate-700">見積依頼から自動で入力する</p>
      {initialTranscript && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          音声入力で話した内容を引き継いでいます。一致する顧客が見つからなかったため、下の顧客欄で選択・新規登録してから「この内容を読み取る」を押してください。
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25"
        >
          📷 写真を撮る
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
        >
          画像/PDFを選択
        </button>
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
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        またはコピペ・音声で
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex items-center gap-3">
        <VoiceInputButton
          targetRef={textareaRef}
          continuous
          onTranscript={(t) => setHasText(t.trim().length > 0)}
        />
        <p className="text-xs text-slate-500">依頼内容を話すか、貼り付けてください</p>
      </div>
      <Textarea
        ref={textareaRef}
        name="transcript"
        rows={4}
        defaultValue={initialTranscript}
        onChange={(e) => setHasText(e.target.value.trim().length > 0)}
        placeholder={"例:\n○○市○○町\n土間コン30㎡\n残土10m3\nブロック20m\n工期○月○日〜○月○日"}
      />
      <button
        type="submit"
        disabled={pending || !hasText}
        className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
      >
        {pending ? "読み取っています..." : "この内容を読み取る"}
      </button>

      {pending && <p className="text-sm text-indigo-700">見積依頼の内容を解析しています...</p>}

      {state?.error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <p>{state.error}</p>
          <p className="mt-1 text-xs">再度お試しいただくか、下のフォームに直接入力してください。</p>
        </div>
      )}

      {state?.extraction && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
          {state.extraction.confidence === "needs_review" && (
            <p className="font-medium text-amber-700">
              ⚠ 一部の項目しか読み取れませんでした。下のフォームで内容を確認してください。
            </p>
          )}
          {state.extraction.confidence === "high" && (
            <p className="font-medium text-emerald-700">読み取りました。下のフォームで内容を確認してください。</p>
          )}
          {state.extraction.unclearFields.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              確認が必要な項目: {state.extraction.unclearFields.join("、")}
            </p>
          )}
          {!state.matchedCustomerId && state.extraction.customerName && (
            <p className="mt-1 text-xs text-amber-700">
              「{state.extraction.customerName}」に一致する顧客が見つかりませんでした。顧客欄を手動で選択するか、先に顧客登録してください。
            </p>
          )}
        </div>
      )}
    </form>
  );
}
