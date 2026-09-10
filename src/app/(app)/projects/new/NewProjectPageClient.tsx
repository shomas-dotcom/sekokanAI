"use client";

import { useState } from "react";
import { ProjectForm } from "../ProjectForm";
import { ProjectRequestScanner } from "../ProjectRequestScanner";
import { createProjectAction } from "../actions";
import { Card, FieldLabel } from "@/components/ui";
import type { ProjectRequestExtraction } from "@/lib/ai";

type CustomerOption = { id: string; name: string };

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function NewProjectPageClient({
  customers,
  initialTranscript,
}: {
  customers: CustomerOption[];
  initialTranscript?: string;
}) {
  // 見積依頼の読み取り結果でフォームの初期値を差し替えるため、keyを変えて
  // ProjectFormを再マウントする(defaultValueのuncontrolled inputへ反映するため)。
  const [scanCount, setScanCount] = useState(0);
  const [prefill, setPrefill] = useState<Record<string, string> | undefined>(undefined);

  function handleExtracted(extraction: ProjectRequestExtraction, matchedCustomerId: string | null) {
    const overviewParts = [extraction.workContent, extraction.quantity].filter(Boolean);
    setPrefill({
      customerId: matchedCustomerId ?? "",
      name: extraction.projectName ?? "",
      siteAddress: extraction.siteAddress ?? "",
      primeContractorName: extraction.primeContractorName ?? "",
      overview: overviewParts.join("\n") || (extraction.periodText ? `工期: ${extraction.periodText}` : ""),
      startDate: toDateInput(extraction.startDate),
      endDate: toDateInput(extraction.endDate),
      contactName: extraction.contactName ?? "",
      contactPhone: extraction.contactPhone ?? "",
      castingDate: toDateInput(extraction.castingDate),
      suppliedItems: extraction.suppliedItems ?? "",
      soilQuantity: extraction.soilQuantity ?? "",
      cautions: extraction.cautions ?? "",
    });
    setScanCount((c) => c + 1);
  }

  return (
    <>
      <div className="max-w-lg">
        <ProjectRequestScanner onExtracted={handleExtracted} initialTranscript={initialTranscript} />
      </div>
      <Card className="max-w-lg">
        <ProjectForm
          key={scanCount}
          action={createProjectAction}
          customers={customers}
          submitLabel="登録する"
          tabsPersistKey="project-new"
          extraTabs={[
            {
              label: "📎 写真・ファイル添付",
              content: (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel label="現地写真・見積依頼資料など(任意)">
                    <input
                      type="file"
                      name="files"
                      multiple
                      accept="image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls,.docx,.doc"
                      className="text-sm"
                    />
                  </FieldLabel>
                  <span className="text-xs text-slate-400">
                    ここで選んだ写真・資料は、案件の「ファイル」欄に保存されます(内容をAIが読み取ることはありません)。後からでも追加できます。
                  </span>
                </div>
              ),
            },
          ]}
          project={
            prefill
              ? {
                  id: "",
                  customerId: prefill.customerId,
                  name: prefill.name,
                  siteAddress: prefill.siteAddress || null,
                  orderingParty: null,
                  primeContractorName: prefill.primeContractorName || null,
                  status: "LEAD",
                  startDate: prefill.startDate || null,
                  endDate: prefill.endDate || null,
                  managerName: null,
                  siteAgentName: null,
                  chiefEngineerName: null,
                  contractAmountExcludingTax: null,
                  taxRatePercent: 10,
                  paymentTerms: null,
                  overview: prefill.overview || null,
                  contactName: prefill.contactName || null,
                  contactPhone: prefill.contactPhone || null,
                  castingDate: prefill.castingDate || null,
                  suppliedItems: prefill.suppliedItems || null,
                  soilQuantity: prefill.soilQuantity || null,
                  cautions: prefill.cautions || null,
                }
              : undefined
          }
        />
      </Card>
    </>
  );
}
