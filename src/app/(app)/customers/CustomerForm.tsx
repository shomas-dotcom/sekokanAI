"use client";

import { useActionState } from "react";
import type { CustomerFormState } from "./actions";
import { Input, Textarea, Button, FieldLabel } from "@/components/ui";

type Customer = {
  id: string;
  name: string;
  contactName: string | null;
  position: string | null;
  department: string | null;
  postalCode: string | null;
  phone: string | null;
  mobilePhone: string | null;
  fax: string | null;
  email: string | null;
  websiteUrl: string | null;
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
      <FieldLabel label="顧客名(会社名)" required>
        <Input name="name" required defaultValue={customer?.name} />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="担当者名">
          <Input name="contactName" defaultValue={customer?.contactName ?? ""} />
        </FieldLabel>
        <FieldLabel label="役職">
          <Input name="position" defaultValue={customer?.position ?? ""} />
        </FieldLabel>
      </div>
      <FieldLabel label="部署名">
        <Input name="department" defaultValue={customer?.department ?? ""} />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="電話番号">
          <Input name="phone" defaultValue={customer?.phone ?? ""} />
        </FieldLabel>
        <FieldLabel label="携帯番号">
          <Input name="mobilePhone" defaultValue={customer?.mobilePhone ?? ""} />
        </FieldLabel>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="FAX">
          <Input name="fax" defaultValue={customer?.fax ?? ""} />
        </FieldLabel>
        <FieldLabel label="メールアドレス">
          <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
        </FieldLabel>
      </div>
      <FieldLabel label="会社URL">
        <Input name="websiteUrl" defaultValue={customer?.websiteUrl ?? ""} />
      </FieldLabel>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <FieldLabel label="郵便番号">
          <Input name="postalCode" defaultValue={customer?.postalCode ?? ""} />
        </FieldLabel>
        <FieldLabel label="住所">
          <Input name="address" defaultValue={customer?.address ?? ""} />
        </FieldLabel>
      </div>
      <FieldLabel label="備考">
        <Textarea name="notes" defaultValue={customer?.notes ?? ""} rows={3} />
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
