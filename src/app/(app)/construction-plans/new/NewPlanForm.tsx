"use client";

import { useActionState } from "react";
import { createConstructionPlanAction } from "../actions";
import { Select, Input, Button, FieldLabel } from "@/components/ui";

export function NewPlanForm({ projects }: { projects: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(createConstructionPlanAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldLabel label="案件" required>
        <Select name="projectId" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </FieldLabel>

      <FieldLabel label="現場代理人(後から入力可)">
        <Input name="agentName" />
      </FieldLabel>
      <FieldLabel label="主任技術者(後から入力可)">
        <Input name="supervisorName" />
      </FieldLabel>

      <p className="text-xs text-slate-500">
        工事概要・施工方針など17章の下書き用テンプレートが作成されます。各章は最初「未入力」の状態から始まり、内容を確認・入力するまで提出可能にはなりません。
      </p>

      {state?.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "作成中..." : "作成する"}
      </Button>
    </form>
  );
}
