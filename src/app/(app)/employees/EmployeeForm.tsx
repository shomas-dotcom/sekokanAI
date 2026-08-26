"use client";

import { useActionState } from "react";
import type { EmployeeFormState } from "./actions";
import { Input, Select, Textarea, Button, FieldLabel } from "@/components/ui";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  REGULAR: "正社員",
  PART_TIME: "パート・アルバイト",
  SUBCONTRACTOR: "一人親方・協力会社",
  OTHER: "その他",
};

type Employee = {
  id: string;
  name: string;
  nameKana: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  employmentType: string;
  hireDate: Date | string | null;
  notes: string | null;
};

function toDateInputValue(value?: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EmployeeForm({
  action,
  employee,
  submitLabel,
}: {
  action: (state: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;
  employee?: Employee;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {employee && <input type="hidden" name="id" value={employee.id} />}

      <FieldLabel label="氏名" required>
        <Input name="name" required defaultValue={employee?.name} />
      </FieldLabel>
      <FieldLabel label="フリガナ">
        <Input name="nameKana" defaultValue={employee?.nameKana ?? ""} />
      </FieldLabel>
      <FieldLabel label="役職">
        <Input name="position" defaultValue={employee?.position ?? ""} />
      </FieldLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="メールアドレス">
          <Input name="email" type="email" defaultValue={employee?.email ?? ""} />
        </FieldLabel>
        <FieldLabel label="電話番号">
          <Input name="phone" defaultValue={employee?.phone ?? ""} />
        </FieldLabel>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="雇用区分">
          <Select name="employmentType" defaultValue={employee?.employmentType ?? "REGULAR"}>
            {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="入社日">
          <Input type="date" name="hireDate" defaultValue={toDateInputValue(employee?.hireDate)} />
        </FieldLabel>
      </div>

      <FieldLabel label="備考">
        <Textarea name="notes" rows={3} defaultValue={employee?.notes ?? ""} />
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
