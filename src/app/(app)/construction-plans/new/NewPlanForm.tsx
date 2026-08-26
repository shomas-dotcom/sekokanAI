"use client";

import { useActionState, useMemo, useState } from "react";
import { createConstructionPlanAction } from "../actions";
import { Select, Input, Button, FieldLabel } from "@/components/ui";

type ProjectOption = {
  id: string;
  label: string;
  siteAgentName: string | null;
  chiefEngineerName: string | null;
};

export function NewPlanForm({ projects }: { projects: ProjectOption[] }) {
  const [state, formAction, pending] = useActionState(createConstructionPlanAction, undefined);
  const [projectId, setProjectId] = useState("");

  // 現場マスタに登録済みの現場代理人・主任技術者があれば、そのまま初期値として使う
  // (同じ情報を案件登録時と施工計画書作成時の二重で入力させないため)
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldLabel label="案件" required>
        <Select
          name="projectId"
          required
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
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

      <FieldLabel label="現場代理人(案件情報から自動入力・修正可)">
        <Input name="agentName" key={`agent-${projectId}`} defaultValue={project?.siteAgentName ?? ""} />
      </FieldLabel>
      <FieldLabel label="主任技術者(案件情報から自動入力・修正可)">
        <Input
          name="supervisorName"
          key={`supervisor-${projectId}`}
          defaultValue={project?.chiefEngineerName ?? ""}
        />
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
