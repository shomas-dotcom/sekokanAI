"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createContractAction, scanContractRequestAction } from "../actions";
import { Input, Select, Button, FieldLabel } from "@/components/ui";
import { todayJstDateString } from "@/lib/timesheet/time";

type ProjectOption = {
  id: string;
  label: string;
  contractAmountExcludingTax: number | null;
  taxRatePercent: number;
};

type QuoteOption = { id: string; projectId: string; title: string; total: number };

export function NewContractForm({
  projects,
  quotes,
}: {
  projects: ProjectOption[];
  quotes: QuoteOption[];
}) {
  const [state, formAction, pending] = useActionState(createContractAction, undefined);
  const [scanState, scanFormAction, scanPending] = useActionState(scanContractRequestAction, undefined);
  const [projectId, setProjectId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const taxRateRef = useRef<HTMLInputElement>(null);
  const contractDateRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const paymentTermsRef = useRef<HTMLInputElement>(null);

  const project = projects.find((p) => p.id === projectId);
  const availableQuotes = useMemo(
    () => quotes.filter((q) => q.projectId === projectId),
    [quotes, projectId]
  );

  // 読み取り結果が届いたら案件を仮選択する(まずこれを反映してから、下のuseEffectで
  // 金額・日付欄を埋める。案件の仮選択で金額欄が初めて画面に現れるため、2段階に分けている)。
  useEffect(() => {
    if (!scanState?.extraction) return;
    if (scanState.matchedProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectId(scanState.matchedProjectId);
      setQuoteId("");
    }
  }, [scanState]);

  useEffect(() => {
    if (!scanState?.extraction) return;
    const ex = scanState.extraction;
    if (ex.contractAmountExcludingTax != null && amountRef.current) {
      amountRef.current.value = String(ex.contractAmountExcludingTax);
    }
    if (ex.taxRatePercent != null && taxRateRef.current) {
      taxRateRef.current.value = String(ex.taxRatePercent);
    }
    if (ex.contractDate && contractDateRef.current) contractDateRef.current.value = ex.contractDate;
    if (ex.startDate && startDateRef.current) startDateRef.current.value = ex.startDate;
    if (ex.endDate && endDateRef.current) endDateRef.current.value = ex.endDate;
    if (ex.paymentTerms && paymentTermsRef.current) paymentTermsRef.current.value = ex.paymentTerms;
    // projectIdが変わって金額欄が新しく表示されたタイミングでも、確実に反映する
  }, [scanState, projectId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4">
        <p className="text-sm font-semibold text-slate-700">発注者からの注文書を読み取る(任意)</p>
        <p className="mt-1 text-xs text-slate-500">
          注文書の画像・PDFを選ぶと、AIが金額・工期・支払条件を読み取り、下のフォームに仮入力します。内容は必ず確認してください。
        </p>
        <form action={scanFormAction} className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="text-sm"
          />
          <Button type="submit" variant="secondary" disabled={scanPending}>
            {scanPending ? "読み取っています..." : "注文書を読み取る"}
          </Button>
        </form>
        {scanState?.error && <p className="mt-2 text-sm text-rose-700">{scanState.error}</p>}
        {scanState?.extraction && (
          <div className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            {scanState.extraction.confidence === "needs_review" && (
              <p className="font-medium text-amber-700">⚠ 一部の項目しか読み取れませんでした。内容を確認してください。</p>
            )}
            {!scanState.matchedProjectId && (
              <p className="mt-1 text-xs text-amber-700">
                発注者名「{scanState.extraction.customerName ?? "不明"}」に一致する案件が見つかりませんでした。案件を手動で選択してください。
              </p>
            )}
            <p className="mt-1 text-xs text-indigo-700">下のフォームに仮入力しました。内容を確認してから作成してください。</p>
          </div>
        )}
      </div>

      <form action={formAction} className="flex flex-col gap-4">
      <FieldLabel label="案件" required>
        <Select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setQuoteId("");
          }}
        >
          <option value="" disabled>
            選択してください
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      {projectId && (
        <FieldLabel label="見積から金額を反映(任意)">
          <Select name="quoteId" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
            <option value="">見積を使わず手入力する</option>
            {availableQuotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}(税込 {q.total.toLocaleString("ja-JP")}円)
              </option>
            ))}
          </Select>
        </FieldLabel>
      )}

      {projectId && !quoteId && (
        <div className="grid grid-cols-2 gap-4">
          <FieldLabel label="契約金額(税抜)" required>
            <Input
              ref={amountRef}
              type="number"
              name="contractAmountExcludingTax"
              required
              defaultValue={project?.contractAmountExcludingTax ?? ""}
            />
          </FieldLabel>
          <FieldLabel label="消費税率(%)">
            <Input ref={taxRateRef} type="number" name="taxRatePercent" defaultValue={project?.taxRatePercent ?? 10} />
          </FieldLabel>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldLabel label="契約日">
          <Input ref={contractDateRef} type="date" name="contractDate" defaultValue={todayJstDateString()} />
        </FieldLabel>
        <FieldLabel label="工期(着手)">
          <Input ref={startDateRef} type="date" name="startDate" />
        </FieldLabel>
        <FieldLabel label="工期(完成)">
          <Input ref={endDateRef} type="date" name="endDate" />
        </FieldLabel>
      </div>

      <FieldLabel label="支払条件">
        <Input ref={paymentTermsRef} name="paymentTerms" placeholder="例: 月末締め翌月末払い" />
      </FieldLabel>

      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        本システムで作成される文書は一般的なひな形です。個別案件の内容、取引条件、法令および発注者指定条件に応じて、行政書士、弁護士、税理士等の専門家へ確認してください。
      </p>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !projectId}>
        {pending ? "作成中..." : "契約書を作成"}
      </Button>
      </form>
    </div>
  );
}
