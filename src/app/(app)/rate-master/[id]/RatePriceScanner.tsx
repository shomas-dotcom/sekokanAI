"use client";

import { useActionState, useRef } from "react";
import { scanRatePriceAction, applyRatePriceAction } from "../actions";
import { Input, Button } from "@/components/ui";

/**
 * 外注先・仕入先からの見積書(画像/PDF)をAIに読み取らせ、単価マスタへ反映するかどうか
 * 人間が確認する欄。読み取り結果はここで一度提案として表示するだけで、
 * 「この内容で反映する」を押すまでは単価マスタは変わらない。
 */
export function RatePriceScanner({ itemId, currentUnit }: { itemId: string; currentUnit: string }) {
  const [state, formAction, pending] = useActionState(scanRatePriceAction, undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        外注先・仕入先の見積書(画像またはPDF)を選ぶと、AIがこの品目の単価を読み取って提案します。反映するかどうかは、内容を確認してから決められます。
      </p>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="itemId" value={itemId} />
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="text-sm"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "読み取っています..." : "見積書を読み取る"}
        </Button>
      </form>

      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}

      {state?.extraction && (
        <form action={applyRatePriceAction} className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
          <input type="hidden" name="id" value={itemId} />
          <p className="text-sm font-medium text-indigo-800">AIの提案(内容を確認・修正してから反映してください)</p>
          {state.extraction.confidence === "needs_review" && (
            <p className="text-xs text-amber-700">
              ⚠ この見積書からは単価を確実には読み取れませんでした。金額を確認してください。
            </p>
          )}
          {state.extraction.unit && state.extraction.unit !== currentUnit && (
            <p className="text-xs text-amber-700">
              ⚠ 見積書の単位「{state.extraction.unit}」が、登録中の単位「{currentUnit}」と異なります。
            </p>
          )}
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            単価(売単価)
            <Input name="unitPrice" type="number" defaultValue={state.extraction.unitPrice ?? ""} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            原価(任意)
            <Input name="costPrice" type="number" defaultValue={state.extraction.costPrice ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            出所(参考)
            <Input name="sourceDescription" defaultValue={state.extraction.sourceDescription ?? ""} />
          </label>
          <Button type="submit" className="w-fit">
            この内容で単価マスタへ反映する
          </Button>
        </form>
      )}
    </div>
  );
}
