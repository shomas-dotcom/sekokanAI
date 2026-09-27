"use client";

import { useActionState } from "react";
import { createQuoteTemplateAction } from "./actions";
import { Input, Button, FieldLabel } from "@/components/ui";

export function NewQuoteTemplateForm() {
  const [state, formAction, pending] = useActionState(createQuoteTemplateAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FieldLabel label="雛形の名前" required>
        <Input name="name" placeholder="例: 標準の見積書、〇〇社指定様式" required />
      </FieldLabel>
      <FieldLabel label="Excelファイル(.xlsx)" required>
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
      </FieldLabel>
      {state?.error && <p className="text-sm text-rose-600">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "登録中…" : "登録して位置合わせへ進む"}
      </Button>
    </form>
  );
}
