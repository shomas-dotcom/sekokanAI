import { EmployeeForm } from "../EmployeeForm";
import { createEmployeeAction } from "../actions";
import { Card } from "@/components/ui";

export default function NewEmployeePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">従業員を追加</h1>
      <Card className="max-w-lg">
        <EmployeeForm action={createEmployeeAction} submitLabel="登録する" />
      </Card>
    </div>
  );
}
