"use client";

import { useActionState, useRef } from "react";
import { scanBusinessCardAction, type BusinessCardScanState } from "./actions";
import type { BusinessCardExtraction } from "@/lib/ai";
import Link from "next/link";

const FIELD_LABEL: Record<string, string> = {
  companyName: "会社名",
  personName: "氏名",
  position: "役職",
  department: "部署名",
  postalCode: "郵便番号",
  address: "住所",
  phone: "電話番号",
  mobilePhone: "携帯番号",
  fax: "FAX",
  email: "メールアドレス",
  companyUrl: "会社URL",
};

/** 読み取った内容を項目ごとに表示する確認欄(誤認識に気付きやすいよう明示する)。 */
function ExtractionSummary({ extraction }: { extraction: BusinessCardExtraction }) {
  const rows = Object.entries(FIELD_LABEL).map(([key, label]) => ({
    label,
    value: (extraction as unknown as Record<string, string | null>)[key],
  }));
  const filled = rows.filter((r) => r.value);
  if (filled.length === 0) {
    return <p className="text-sm text-slate-500">読み取れた項目がありませんでした。</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      {filled.map((r) => (
        <div key={r.label} className="flex gap-2">
          <dt className="shrink-0 text-slate-400">{r.label}</dt>
          <dd className="text-slate-800">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 名刺の読み取り欄。「写真添付」タブはカメラ撮影のみ、「資料添付」タブは
 * ファイル選択(画像/PDF)のみに絞る(1画面1操作にして迷わないようにする)。
 * 読み取り結果は保存せず、親コンポーネントへ渡して入力フォームへ仮入力させる
 * (登録は必ずユーザーが下の確認画面で行う)。
 */
export function BusinessCardScanner({
  onExtracted,
  mode,
}: {
  onExtracted: (extraction: BusinessCardExtraction) => void;
  mode: "camera" | "file";
}) {
  const [state, formAction, pending] = useActionState<BusinessCardScanState, FormData>(
    async (prevState, formData) => {
      const result = await scanBusinessCardAction(prevState, formData);
      if (result?.extraction) onExtracted(result.extraction);
      return result;
    },
    undefined
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(input: HTMLInputElement | null) {
    if (!input?.files?.[0] || !formRef.current) return;
    formRef.current.requestSubmit();
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-slate-700">
          {mode === "camera" ? "名刺をカメラで撮影する" : "名刺の画像・PDFを選択する"}
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-fit items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25"
        >
          {mode === "camera" ? "📷 名刺を撮影" : "📄 ファイルを選択"}
        </button>
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept={mode === "camera" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
          capture={mode === "camera" ? "environment" : undefined}
          className="hidden"
          onChange={(e) => submit(e.target)}
        />

        {pending && <p className="text-sm text-indigo-700">名刺を読み取っています...</p>}

        {state?.error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <p>{state.error}</p>
            <p className="mt-1 text-xs">
              再度撮影し直すか、別のファイルを選び直してください。うまくいかない場合は下のフォームに直接入力してください。
            </p>
          </div>
        )}

        {state?.extraction && (
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            {state.extraction.confidence === "needs_review" && (
              <p className="mb-2 text-sm font-medium text-amber-700">
                ⚠ 一部の項目しか読み取れませんでした。下の内容を確認してください。
              </p>
            )}
            {state.extraction.confidence === "high" && (
              <p className="mb-2 text-sm font-medium text-emerald-700">読み取った内容(念のため確認してください)</p>
            )}
            <ExtractionSummary extraction={state.extraction} />
            {state.duplicates.length > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
