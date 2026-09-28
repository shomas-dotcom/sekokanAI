"use client";

import { useTransition } from "react";
import { setDailyReportTemplateActiveAction } from "./actions";
import { Button } from "@/components/ui";

export function ActiveToggleButton({ templateId, isActive }: { templateId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("templateId", templateId);
        formData.set("isActive", String(!isActive));
        startTransition(() => {
          setDailyReportTemplateActiveAction(formData);
        });
      }}
    >
      {isActive ? "無効にする(日報で選べなくする)" : "有効にする"}
    </Button>
  );
}
