"use client";

import { useActionState } from "react";
import type { WorkItemFormState } from "./actions";
import { Input, Button, FieldLabel } from "@/components/ui";

type WorkItem = {
  id: string;
  label: string;
  sortOrder: number;
};

export function WorkItemForm({
  action,
  workItem,
  submitLabel,
}: {
  action: (state: WorkItemFormState, formData: FormData) => Promise<WorkItemFormState>;
  workItem?: WorkItem;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {workItem && <input type="hidden" name="id" value={workItem.id} />}
      <FieldLabel label="作業内容" required>
        <Input name="label" required defaultValue={workItem?.label} placeholder="例: 掘削" />
      </FieldLabel>
      <FieldLabel label="表示順(小さいほど先に表示)">
        <Input name="sortOrder" type="number" defaultValue={workItem?.sortOrder ?? 0} />
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
