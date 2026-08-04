import { CustomerForm } from "../CustomerForm";
import { createCustomerAction } from "../actions";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-zinc-900">顧客を追加</h1>
      <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <CustomerForm action={createCustomerAction} submitLabel="登録する" />
      </div>
    </div>
  );
}
