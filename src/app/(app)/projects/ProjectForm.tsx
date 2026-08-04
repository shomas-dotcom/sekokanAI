"use client";

import { useActionState } from "react";
import type { ProjectFormState } from "./actions";
import { STATUS_LABEL } from "./statusLabel";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { Input, Select, Button, FieldLabel } from "@/components/ui";

type Project = {
  id: string;
  customerId: string;
  name: string;
  siteAddress: string | null;
  orderingParty: string | null;
  status: ProjectStatus;
};

export function ProjectForm({
  action,
  project,
  customers,
  submitLabel,
}: {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  project?: Project;
  customers: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {project && <input type="hidden" name="id" value={project.id} />}

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

      <FieldLabel label="案件名" required>
        <Input name="name" required defaultValue={project?.name} />
      </FieldLabel>

      <FieldLabel label="現場住所">
        <Input name="siteAddress" defaultValue={project?.siteAddress ?? ""} />
      </FieldLabel>

      <FieldLabel label="発注者">
        <Input name="orderingParty" defaultValue={project?.orderingParty ?? ""} />
      </FieldLabel>

      <FieldLabel label="ステータス">
        <Select name="status" defaultValue={project?.status ?? "LEAD"}>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
