"use client";

import { useActionState, useMemo, useState } from "react";
import { createContractAction } from "../actions";
import { Input, Select, Button, FieldLabel } from "@/components/ui";

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
  const [projectId, setProjectId] = useState("");
  const [quoteId, setQuoteId] = useState("");

  const project = projects.find((p) => p.id === projectId);
  const availableQuotes = useMemo(
    () => quotes.filter((q) => q.projectId === projectId),
    [quotes, projectId]
  );

  return (
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
              type="number"
              name="contractAmountExcludingTax"
              required
              defaultValue={project?.contractAmountExcludingTax ?? ""}
            />
          </FieldLabel>
          <FieldLabel label="消費税率(%)">
            <Input type="number" name="taxRatePercent" defaultValue={project?.taxRatePercent ?? 10} />
          </FieldLabel>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldLabel label="契約日">
          <Input type="date" name="contractDate" defaultValue={new Date().toISOString().slice(0, 10)} />
        </FieldLabel>
        <FieldLabel label="工期(着手)">
          <Input type="date" name="startDate" />
        </FieldLabel>
        <FieldLabel label="工期(完成)">
          <Input type="date" name="endDate" />
        </FieldLabel>
      </div>

      <FieldLabel label="支払条件">
        <Input name="paymentTerms" placeholder="例: 月末締め翌月末払い" />
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
  );
}
