"use client";

import { useState } from "react";
import { EmployeeForm } from "../EmployeeForm";
import { createEmployeeAction, scanEmployeeVoiceAction } from "../actions";
import { Card } from "@/components/ui";
import { VoiceFormFiller } from "@/components/VoiceFormFiller";
import type { EmployeeFieldExtraction } from "@/lib/ai";

export default function NewEmployeePage() {
  // 音声読み取り結果でフォームの初期値を差し替えるため、keyを変えて
  // EmployeeFormを再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Partial<Record<string, string>> | undefined>(undefined);

  function handleExtracted(extraction: EmployeeFieldExtraction) {
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">従業員を追加</h1>
      <div className="max-w-lg">
        <VoiceFormFiller
          action={scanEmployeeVoiceAction}
          onExtracted={handleExtracted}
          placeholder="氏名・役職・電話番号など"
        />
      </div>
      <Card className="max-w-lg">
        <EmployeeForm
          key={scanCount}
          action={createEmployeeAction}
          submitLabel="登録する"
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
