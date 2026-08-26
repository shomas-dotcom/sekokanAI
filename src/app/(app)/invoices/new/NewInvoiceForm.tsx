"use client";

import { useActionState, useMemo, useState } from "react";
import { createInvoiceAction } from "../actions";
import { BILLING_TYPE_LABEL } from "../statusLabel";
import { Input, Select, Button, FieldLabel } from "@/components/ui";

type ProjectOption = { id: string; label: string };
type ContractOption = { id: string; projectId: string; label: string };

export function NewInvoiceForm({
  projects,
  contracts,
}: {
  projects: ProjectOption[];
  contracts: ContractOption[];
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, undefined);
  const [projectId, setProjectId] = useState("");

  const availableContracts = useMemo(
    () => contracts.filter((c) => c.projectId === projectId),
    [contracts, projectId]
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldLabel label="案件" required>
        <Select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
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
        <FieldLabel label="契約書(任意・出来高計算に使用)">
          <Select name="contractId" defaultValue="">
            <option value="">契約書と紐付けない</option>
            {availableContracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </FieldLabel>
      )}

      <FieldLabel label="請求区分">
        <Select name="billingType" defaultValue="FULL">
          {Object.entries(BILLING_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <div className="grid grid-cols-2 gap-4">
        <FieldLabel label="発行日">
          <Input type="date" name="issueDate" defaultValue={new Date().toISOString().slice(0, 10)} />
        </FieldLabel>
        <FieldLabel label="支払期限">
          <Input type="date" name="dueDate" />
        </FieldLabel>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !projectId}>
        {pending ? "作成中..." : "請求書を作成(明細は次の画面で入力)"}
      </Button>
    </form>
  );
}
