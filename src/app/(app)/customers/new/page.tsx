"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CustomerForm } from "../CustomerForm";
import { BusinessCardScanner } from "../BusinessCardScanner";
import { createCustomerAction, scanCustomerVoiceAction } from "../actions";
import { Card } from "@/components/ui";
import { Tabs } from "@/components/Tabs";
import { VoiceFormFiller } from "@/components/VoiceFormFiller";
import type { BusinessCardExtraction } from "@/lib/ai";

export default function NewCustomerPage() {
  // 「AIに話す」窓口から引き継いだ音声認識結果があれば、音声入力タブを開いた状態で
  // 初期値として入れておく(既存の写真添付・資料添付タブはそのまま)。
  const searchParams = useSearchParams();
  const prefillTranscript = searchParams.get("prefillTranscript") ?? undefined;

  // 読み取り結果でフォームの初期値を差し替えるため、keyを変えてCustomerFormを
  // 再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Partial<Record<string, string>> | undefined>(undefined);
  const [hasExtracted, setHasExtracted] = useState(false);

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
    setHasExtracted(true);
    setScanCount((c) => c + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">顧客を追加</h1>

      <div className="max-w-lg">
        <Tabs
          initialActive={prefillTranscript ? 2 : 0}
          persistKey="customer-new"
          tabs={[
            {
              label: "📷 写真添付",
              content: <BusinessCardScanner mode="camera" onExtracted={handleExtracted} />,
            },
            {
              label: "📄 資料添付",
              content: <BusinessCardScanner mode="file" onExtracted={handleExtracted} />,
            },
            {
              label: "🎤 音声入力",
              content: (
                <VoiceFormFiller
                  action={scanCustomerVoiceAction}
                  onExtracted={handleExtracted}
                  placeholder="会社名・担当者・電話番号・メールアドレスなど"
                  initialTranscript={prefillTranscript}
                />
              ),
            },
          ]}
        />
      </div>

      <Card className="max-w-lg">
        <h2 className="mb-3 font-semibold text-slate-900">
          {hasExtracted ? "④ 内容を確認して登録" : "手入力で登録"}
        </h2>
        {hasExtracted && (
          <p className="mb-3 text-xs text-slate-500">
            自動で入力しました。間違っている項目があれば直接書き直してから登録してください。
          </p>
        )}
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
