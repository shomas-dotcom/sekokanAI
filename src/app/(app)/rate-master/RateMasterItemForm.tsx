"use client";

import { useActionState } from "react";
import type { RateMasterFormState } from "./actions";
import { Input, Select, Textarea, Button, FieldLabel } from "@/components/ui";
import { RATE_CATEGORY_LABEL } from "@/lib/rateMaster";

type RateMasterItem = {
  id: string;
  category: string;
  name: string;
  unit: string;
  unitPrice: number;
  costPrice: number | null;
  notes: string | null;
};

export function RateMasterItemForm({
  action,
  item,
  submitLabel,
}: {
  action: (state: RateMasterFormState, formData: FormData) => Promise<RateMasterFormState>;
  item?: RateMasterItem;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {item && <input type="hidden" name="id" value={item.id} />}

      <FieldLabel label="区分" required>
        <Select name="category" defaultValue={item?.category ?? "MACHINERY"}>
          {Object.entries(RATE_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="品目名" required>
        <Input name="name" required defaultValue={item?.name} placeholder="例: 0.25BHバックホウ(日極)" />
      </FieldLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldLabel label="単位" required>
          <Input name="unit" required defaultValue={item?.unit ?? "式"} />
        </FieldLabel>
        <FieldLabel label="売単価(円)" required>
          <Input name="unitPrice" type="number" required defaultValue={item?.unitPrice ?? 0} />
        </FieldLabel>
        <FieldLabel label="原価(円・任意)">
          <Input name="costPrice" type="number" defaultValue={item?.costPrice ?? ""} />
        </FieldLabel>
      </div>

      <FieldLabel label="備考">
        <Textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} />
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
