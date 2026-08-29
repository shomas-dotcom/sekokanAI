"use client";

import { useState } from "react";
import { EmployeeForm } from "../EmployeeForm";
import { IdCardScanner } from "../IdCardScanner";
import { createEmployeeAction, scanEmployeeVoiceAction } from "../actions";
import { Card } from "@/components/ui";
import { VoiceFormFiller } from "@/components/VoiceFormFiller";
import type { EmployeeFieldExtraction, IdCardExtraction } from "@/lib/ai";

export default function NewEmployeePage() {
  // 読み取り結果でフォームの初期値を差し替えるため、keyを変えて
  // EmployeeFormを再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Partial<Record<string, string>> | undefined>(undefined);
  const [pendingQualification, setPendingQualification] = useState<
    { name: string; expiresAt: string | null } | undefined
  >(undefined);

  function handleVoiceExtracted(extraction: EmployeeFieldExtraction) {
    setPrefill({
      name: extraction.name ?? "",
      nameKana: extraction.nameKana ?? "",
      position: extraction.position ?? "",
      email: extraction.email ?? "",
      phone: extraction.phone ?? "",
      notes: extraction.notes ?? "",
    });
    setScanCount((c) => c + 1);
  }

  function handleIdCardExtracted(extraction: IdCardExtraction) {
    setPrefill((prev) => ({
      ...prev,
      name: extraction.name ?? prev?.name ?? "",
      nameKana: extraction.nameKana ?? prev?.nameKana ?? "",
    }));
    if (extraction.licenseType) {
      setPendingQualification({ name: extraction.licenseType, expiresAt: extraction.licenseExpiry });
    }
    setScanCount((c) => c + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">従業員を追加</h1>
      <div className="flex max-w-lg flex-col gap-3">
        <IdCardScanner onExtracted={handleIdCardExtracted} />
        <VoiceFormFiller
          action={scanEmployeeVoiceAction}
          onExtracted={handleVoiceExtracted}
          placeholder="氏名・役職・電話番号など"
        />
      </div>
      <Card className="max-w-lg">
        <EmployeeForm
          key={scanCount}
          action={createEmployeeAction}
          submitLabel="登録する"
          pendingQualification={pendingQualification}
          employee={
            prefill
              ? {
                  id: "",
                  name: prefill.name ?? "",
                  nameKana: prefill.nameKana || null,
                  position: prefill.position || null,
                  email: prefill.email || null,
                  phone: prefill.phone || null,
                  employmentType: "REGULAR",
                  hireDate: null,
                  notes: prefill.notes || null,
                }
              : undefined
          }
        />
      </Card>
    </div>
  );
}
