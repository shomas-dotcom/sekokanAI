"use client";

import { useActionState } from "react";
import { createQuoteAction } from "../actions";

export function NewQuoteForm({ projects }: { projects: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createQuoteAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        案件<span className="text-red-500"> *</span>
        <select
          name="projectId"
          required
          defaultValue=""
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        >
          <option value="" disabled>
            選択してください
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        見積名<span className="text-red-500"> *</span>
        <input
          name="title"
          required
          placeholder="例: 道路築造工事 見積書"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        工事内容(自由記述、任意)
        <textarea
          name="freeText"
          rows={4}
          placeholder={"例:\n掘削工\n残土処分\nL型側溝設置"}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-xs text-zinc-400">
          改行区切りでAIが見積項目の下書きを作成します(単価は未設定・要確認)。空欄でも作成できます。
        </span>
      </label>

      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "作成中..." : "見積を作成"}
      </button>
    </form>
  );
}
