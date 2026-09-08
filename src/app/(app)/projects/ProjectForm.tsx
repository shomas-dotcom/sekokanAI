"use client";

import { useActionState } from "react";
import type { ProjectFormState } from "./actions";
import { STATUS_LABEL } from "./statusLabel";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { Input, Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { Tabs } from "@/components/Tabs";

type Project = {
  id: string;
  customerId: string;
  projectCode?: string | null;
  name: string;
  siteAddress: string | null;
  orderingParty: string | null;
  primeContractorName?: string | null;
  status: ProjectStatus;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  managerName?: string | null;
  siteAgentName?: string | null;
  chiefEngineerName?: string | null;
  contractAmountExcludingTax?: number | null;
  taxRatePercent?: number;
  paymentTerms?: string | null;
  overview?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  castingDate?: Date | string | null;
  suppliedItems?: string | null;
  soilQuantity?: string | null;
  cautions?: string | null;
};

function toDateInputValue(value?: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ProjectForm({
  action,
  project,
  customers,
  submitLabel,
  extraTabs,
}: {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  project?: Project;
  customers: { id: string; name: string }[];
  submitLabel: string;
  /** 新規登録画面専用の追加タブ(例: 写真・ファイル添付)。編集画面では渡さないため表示は変わらない。 */
  extraTabs?: { label: string; content: React.ReactNode }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  const fields = (
    <div className="flex flex-col gap-4">
      {project && <input type="hidden" name="id" value={project.id} />}

      {project?.projectCode && (
        <p className="text-xs text-slate-500">工事番号: {project.projectCode}</p>
      )}

      <FieldLabel label="顧客" required>
        <Select name="customerId" required defaultValue={project?.customerId ?? ""}>
          <option value="" disabled>
            選択してください
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="工事名" required>
        <Input name="name" required defaultValue={project?.name} />
      </FieldLabel>

      <FieldLabel label="工事場所">
        <Input name="siteAddress" defaultValue={project?.siteAddress ?? ""} />
      </FieldLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="発注者">
          <Input name="orderingParty" defaultValue={project?.orderingParty ?? ""} />
        </FieldLabel>
        <FieldLabel label="元請(自社が下請の場合)">
          <Input name="primeContractorName" defaultValue={project?.primeContractorName ?? ""} />
        </FieldLabel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="発注者側の担当者">
          <Input name="contactName" defaultValue={project?.contactName ?? ""} />
        </FieldLabel>
        <FieldLabel label="発注者側の電話番号">
          <Input name="contactPhone" defaultValue={project?.contactPhone ?? ""} />
        </FieldLabel>
      </div>

      <FieldLabel label="工事概要(工事内容・数量等)">
        <Textarea name="overview" rows={3} defaultValue={project?.overview ?? ""} />
      </FieldLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="支給品(任意)">
          <Input name="suppliedItems" defaultValue={project?.suppliedItems ?? ""} />
        </FieldLabel>
        <FieldLabel label="残土数量(任意)">
          <Input name="soilQuantity" defaultValue={project?.soilQuantity ?? ""} placeholder="例: 10m3" />
        </FieldLabel>
      </div>

      <FieldLabel label="注意事項(任意)">
        <Textarea name="cautions" rows={2} defaultValue={project?.cautions ?? ""} />
      </FieldLabel>

      <div className="grid grid-cols-2 gap-4">
        <FieldLabel label="工期(着手)">
          <Input type="date" name="startDate" defaultValue={toDateInputValue(project?.startDate)} />
        </FieldLabel>
        <FieldLabel label="工期(完成)">
          <Input type="date" name="endDate" defaultValue={toDateInputValue(project?.endDate)} />
        </FieldLabel>
      </div>

      <FieldLabel label="打設日(任意)">
        <Input type="date" name="castingDate" defaultValue={toDateInputValue(project?.castingDate)} />
      </FieldLabel>

      <div className="grid grid-cols-2 gap-4">
        <FieldLabel label="契約金額(税抜・目安)">
          <Input
            type="number"
            name="contractAmountExcludingTax"
            defaultValue={project?.contractAmountExcludingTax ?? ""}
          />
        </FieldLabel>
        <FieldLabel label="消費税率(%)">
          <Input type="number" name="taxRatePercent" defaultValue={project?.taxRatePercent ?? 10} />
        </FieldLabel>
      </div>

      <FieldLabel label="支払条件">
        <Input
          name="paymentTerms"
          defaultValue={project?.paymentTerms ?? ""}
          placeholder="例: 月末締め翌月末払い"
        />
      </FieldLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldLabel label="自社担当者">
          <Input name="managerName" defaultValue={project?.managerName ?? ""} />
        </FieldLabel>
        <FieldLabel label="現場代理人">
          <Input name="siteAgentName" defaultValue={project?.siteAgentName ?? ""} />
        </FieldLabel>
        <FieldLabel label="主任技術者">
          <Input name="chiefEngineerName" defaultValue={project?.chiefEngineerName ?? ""} />
        </FieldLabel>
      </div>

      <FieldLabel label="ステータス">
        <Select name="status" defaultValue={project?.status ?? "LEAD"}>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>
    </div>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {extraTabs && extraTabs.length > 0 ? (
        <Tabs tabs={[{ label: "基本情報", content: fields }, ...extraTabs]} />
      ) : (
        fields
      )}

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
