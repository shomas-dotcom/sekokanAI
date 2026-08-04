"use client";

import { useActionState } from "react";
import type { CustomerFormState } from "./actions";

type Customer = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: Customer;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <Field label="顧客名" name="name" required defaultValue={customer?.name} />
      <Field label="担当者名" name="contactName" defaultValue={customer?.contactName ?? ""} />
      <Field label="電話番号" name="phone" defaultValue={customer?.phone ?? ""} />
      <Field label="メールアドレス" name="email" type="email" defaultValue={customer?.email ?? ""} />
      <Field label="住所" name="address" defaultValue={customer?.address ?? ""} />
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
        備考
        <textarea
          name="notes"
          defaultValue={customer?.notes ?? ""}
          rows={3}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
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

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}
