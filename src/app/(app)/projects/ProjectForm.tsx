"use client";

import { useActionState } from "react";
import type { ProjectFormState } from "./actions";
import { STATUS_LABEL } from "./statusLabel";
import type { ProjectStatus } from "@/generated/prisma/enums";

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

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        顧客<span className="text-red-500"> *</span>
        <select
          name="customerId"
          required
          defaultValue={project?.customerId ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        >
          <option value="" disabled>
            選択してください
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        案件名<span className="text-red-500"> *</span>
        <input
          name="name"
          required
          defaultValue={project?.name}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        現場住所
        <input
          name="siteAddress"
          defaultValue={project?.siteAddress ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        発注者
        <input
          name="orderingParty"
          defaultValue={project?.orderingParty ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        ステータス
        <select
          name="status"
          defaultValue={project?.status ?? "LEAD"}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {state?.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "保存中..." : submitLabel}
      </button>
    </form>
  );
}
