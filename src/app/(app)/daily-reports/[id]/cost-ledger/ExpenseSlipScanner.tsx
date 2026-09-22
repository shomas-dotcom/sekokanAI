"use client";

import { useActionState } from "react";
import { scanExpenseSlipAction, addPartnerItemAction } from "./actions";
import { Input, Select, Button } from "@/components/ui";

/**
 * 協力会社の請求書・伝票をAIに読み取らせ、「協力会社持込資機材」「その他経費」への
 * 追加候補を作る。反映(追加)は既存のaddPartnerItemActionをそのまま使う
 * (保存処理を新しく作らず、内容を確認してから人間が追加を確定する)。
 */
export function ExpenseSlipScanner({ dailyReportId }: { dailyReportId: string }) {
  const [state, formAction, pending] = useActionState(scanExpenseSlipAction, undefined);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 p-3">
      <p className="text-xs font-medium text-slate-600">協力会社の請求書・伝票をAIで読み取る(任意)</p>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="dailyReportId" value={dailyReportId} />
        <Input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "読み取っています..." : "伝票を読み取る"}
        </Button>
      </form>

      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}

      {state?.extraction && (
        <form action={addPartnerItemAction} className="flex flex-wrap items-end gap-2 rounded-lg bg-indigo-50/50 p-2">
          <input type="hidden" name="dailyReportId" value={dailyReportId} />
          {state.extraction.confidence === "needs_review" && (
            <p className="w-full text-xs text-amber-700">⚠ 一部の項目しか読み取れませんでした。内容を確認してください。</p>
          )}
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            区分
            <Select name="kind" defaultValue={state.extraction.categoryHint ?? "PARTNER_EQUIPMENT"} className="w-32">
              <option value="PARTNER_EQUIPMENT">協力会社持込資機材</option>
              <option value="OTHER_EXPENSE">その他経費</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            名称
            <Input name="name" defaultValue={state.extraction.name ?? ""} className="w-32" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            数量
            <Input name="quantity" defaultValue={state.extraction.quantity ?? ""} className="w-20" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            金額
            <Input name="unitPrice" type="number" defaultValue={state.extraction.unitPrice ?? ""} className="w-24" />
          </label>
          <Button type="submit" variant="secondary">
            この内容で追加
          </Button>
        </form>
      )}
    </div>
  );
}
