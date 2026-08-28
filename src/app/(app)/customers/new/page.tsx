"use client";

import { useState } from "react";
import { CustomerForm } from "../CustomerForm";
import { BusinessCardScanner } from "../BusinessCardScanner";
import { createCustomerAction } from "../actions";
import { Card } from "@/components/ui";
import type { BusinessCardExtraction } from "@/lib/ai";

export default function NewCustomerPage() {
  // 名刺読み取り結果でフォームの初期値を差し替えるため、keyを変えて
  // CustomerFormを再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Partial<Record<string, string>> | undefined>(undefined);

  function handleExtracted(extraction: BusinessCardExtraction) {
    setPrefill({
      id: "",
      name: extraction.companyName ?? "",
      contactName: extraction.personName ?? "",
      position: extraction.position ?? "",
      department: extraction.department ?? "",
      postalCode: extraction.postalCode ?? "",
      phone: extraction.phone ?? "",
      mobilePhone: extraction.mobilePhone ?? "",
      fax: extraction.fax ?? "",
      email: extraction.email ?? "",
      websiteUrl: extraction.companyUrl ?? "",
      address: extraction.address ?? "",
      notes: extraction.notes ?? "",
    });
    setScanCount((c) => c + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">顧客を追加</h1>
      <div className="max-w-lg">
        <BusinessCardScanner onExtracted={handleExtracted} />
      </div>
      <Card className="max-w-lg">
        <CustomerForm
          key={scanCount}
          action={createCustomerAction}
          submitLabel="登録する"
          customer={
            prefill
              ? {
                  id: "",
                  name: prefill.name ?? "",
                  contactName: prefill.contactName || null,
                  position: prefill.position || null,
                  department: prefill.department || null,
                  postalCode: prefill.postalCode || null,
                  phone: prefill.phone || null,
                  mobilePhone: prefill.mobilePhone || null,
                  fax: prefill.fax || null,
                  email: prefill.email || null,
                  websiteUrl: prefill.websiteUrl || null,
                  address: prefill.address || null,
                  notes: prefill.notes || null,
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}
