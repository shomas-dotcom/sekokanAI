"use client";

import { useActionState } from "react";
import type { SettingsFormState } from "./actions";
import { Input, Button, FieldLabel } from "@/components/ui";

type Company = {
  name: string;
  postalCode: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  representativeName: string | null;
  licenseNumber: string | null;
  invoiceRegistrationNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  logoUrl: string | null;
};

export function SettingsForm({
  action,
  company,
}: {
  action: (state: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  company: Company;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="会社名" required>
          <Input name="name" required defaultValue={company.name} />
        </FieldLabel>
        <FieldLabel label="代表者名">
          <Input name="representativeName" defaultValue={company.representativeName ?? ""} />
        </FieldLabel>
        <FieldLabel label="郵便番号">
          <Input name="postalCode" defaultValue={company.postalCode ?? ""} placeholder="123-4567" />
        </FieldLabel>
        <FieldLabel label="住所">
          <Input name="address" defaultValue={company.address ?? ""} />
        </FieldLabel>
        <FieldLabel label="電話番号">
          <Input name="phone" defaultValue={company.phone ?? ""} />
        </FieldLabel>
        <FieldLabel label="FAX">
          <Input name="fax" defaultValue={company.fax ?? ""} />
        </FieldLabel>
        <FieldLabel label="メールアドレス">
          <Input name="email" type="email" defaultValue={company.email ?? ""} />
        </FieldLabel>
        <FieldLabel label="ロゴURL">
          <Input name="logoUrl" defaultValue={company.logoUrl ?? ""} placeholder="https://..." />
        </FieldLabel>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldLabel label="建設業許可番号">
          <Input name="licenseNumber" defaultValue={company.licenseNumber ?? ""} />
        </FieldLabel>
        <FieldLabel label="適格請求書発行事業者登録番号">
          <Input
            name="invoiceRegistrationNumber"
            defaultValue={company.invoiceRegistrationNumber ?? ""}
            placeholder="T1234567890123"
          />
        </FieldLabel>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-900">振込先(請求書に表示されます)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldLabel label="銀行名">
            <Input name="bankName" defaultValue={company.bankName ?? ""} />
          </FieldLabel>
          <FieldLabel label="支店名">
            <Input name="bankBranch" defaultValue={company.bankBranch ?? ""} />
          </FieldLabel>
          <FieldLabel label="口座種別">
            <Input name="bankAccountType" defaultValue={company.bankAccountType ?? ""} placeholder="普通 / 当座" />
          </FieldLabel>
          <FieldLabel label="口座番号">
            <Input name="bankAccountNumber" defaultValue={company.bankAccountNumber ?? ""} />
          </FieldLabel>
          <FieldLabel label="口座名義">
            <Input name="bankAccountHolder" defaultValue={company.bankAccountHolder ?? ""} />
          </FieldLabel>
        </div>
        <p className="text-xs text-slate-500">
          銀行口座情報はこの画面から事業者本人が登録してください。開発用のダミー値をコード・シードデータに含めることはありません(SECURITY.md)。
        </p>
      </section>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "保存中..." : "保存する"}
      </Button>
    </form>
  );
}
