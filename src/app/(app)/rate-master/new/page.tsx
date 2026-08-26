import { RateMasterItemForm } from "../RateMasterItemForm";
import { createRateMasterItemAction } from "../actions";
import { Card } from "@/components/ui";

export default function NewRateMasterItemPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">単価を追加</h1>
      <Card className="max-w-lg">
        <RateMasterItemForm action={createRateMasterItemAction} submitLabel="登録する" />
      </Card>
    </div>
  );
}
