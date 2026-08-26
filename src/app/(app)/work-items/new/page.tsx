import { WorkItemForm } from "../WorkItemForm";
import { createWorkItemAction } from "../actions";
import { Card } from "@/components/ui";

export default function NewWorkItemPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">作業内容を追加</h1>
      <Card className="max-w-lg">
        <WorkItemForm action={createWorkItemAction} submitLabel="登録する" />
      </Card>
    </div>
  );
}
