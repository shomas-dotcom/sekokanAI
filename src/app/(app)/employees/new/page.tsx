"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmployeeForm } from "../EmployeeForm";
import { IdCardScanner } from "../IdCardScanner";
import { createEmployeeAction, scanEmployeeVoiceAction } from "../actions";
import { Card } from "@/components/ui";
import { Tabs } from "@/components/Tabs";
import { VoiceFormFiller } from "@/components/VoiceFormFiller";
import type { EmployeeFieldExtraction, IdCardExtraction } from "@/lib/ai";

export default function NewEmployeePage() {
  // 「AIに話す」窓口から引き継いだ音声認識結果があれば、音声入力タブを開いた状態で
  // 初期値として入れておく。
  const searchParams = useSearchParams();
  const prefillTranscript = searchParams.get("prefillTranscript") ?? undefined;

  // 読み取り結果でフォームの初期値を差し替えるため、keyを変えて
  // EmployeeFormを再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Partial<Record<string, string>> | undefined>(undefined);
  const [hasExtracted, setHasExtracted] = useState(false);
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
    setHasExtracted(true);
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
    setHasExtracted(true);
    setScanCount((c) => c + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">従業員を追加</h1>

      <div className="max-w-lg">
        <Tabs
          initialActive={prefillTranscript ? 2 : 0}
          persistKey="employee-new"
          tabs={[
            {
              label: "📷 写真添付",
              content: <IdCardScanner mode="camera" onExtracted={handleIdCardExtracted} />,
            },
            {
              label: "📄 資料添付",
              content: <IdCardScanner mode="file" onExtracted={handleIdCardExtracted} />,
            },
            {
              label: "🎤 音声入力",
              content: (
                <VoiceFormFiller
                  action={scanEmployeeVoiceAction}
                  onExtracted={handleVoiceExtracted}
                  placeholder="氏名・役職・電話番号など"
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
