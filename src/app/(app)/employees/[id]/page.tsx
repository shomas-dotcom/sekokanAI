import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "../EmployeeForm";
import { updateEmployeeAction, deleteEmployeeAction } from "../actions";
import { QualificationSection } from "./QualificationSection";
import { Card, Button } from "@/components/ui";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const employee = await prisma.employee.findFirst({
    where: { id, companyId: user.companyId },
    include: { qualifications: { orderBy: { createdAt: "desc" } } },
  });
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
      <Card className="max-w-lg">
        <EmployeeForm action={updateEmployeeAction} employee={employee} submitLabel="更新する" />
      </Card>

      <Card className="max-w-lg">
        <h2 className="mb-3 font-semibold text-slate-900">保有資格</h2>
        <QualificationSection employeeId={employee.id} qualifications={employee.qualifications} />
      </Card>

      <form action={deleteEmployeeAction} className="max-w-lg">
        <input type="hidden" name="id" value={employee.id} />
        <Button type="submit" variant="danger">
          この従業員を削除する
        </Button>
      </form>
    </div>
  );
}
