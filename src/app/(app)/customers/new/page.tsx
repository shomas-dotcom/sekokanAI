import { CustomerForm } from "../CustomerForm";
import { createCustomerAction } from "../actions";
import { Card } from "@/components/ui";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">顧客を追加</h1>
      <Card className="max-w-lg">
        <CustomerForm action={createCustomerAction} submitLabel="登録する" />
      </Card>
    </div>
  );
}
