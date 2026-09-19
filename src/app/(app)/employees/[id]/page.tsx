import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmployeeForm } from "../EmployeeForm";
import { updateEmployeeAction, deleteEmployeeAction } from "../actions";
import { QualificationSection } from "./QualificationSection";
import { EmployeeUserLinkSection } from "./EmployeeUserLinkSection";
import { Card, Button } from "@/components/ui";
import { Tabs } from "@/components/Tabs";
import { EntityFileSection } from "@/components/entityFiles/EntityFileSection";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [employee, files, linkedUser, candidateUsers] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, companyId: user.companyId },
      include: { qualifications: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.entityFile.findMany({
      where: { entityType: "EMPLOYEE", entityId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findFirst({
      where: { employeeId: id, companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null, employeeId: null },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
      <Tabs
        tabs={[
          {
            label: "基本情報",
            content: (
              <div className="flex max-w-lg flex-col gap-4">
                <Card>
                  <EmployeeForm action={updateEmployeeAction} employee={employee} submitLabel="更新する" />
                </Card>
                <Card>
                  <h2 className="mb-3 font-semibold text-slate-900">保有資格</h2>
                  <QualificationSection employeeId={employee.id} qualifications={employee.qualifications} />
                </Card>
                {user.role === "ADMIN" && (
                  <Card>
                    <h2 className="mb-1 font-semibold text-slate-900">ログイン利用者との関連付け</h2>
                    <p className="mb-3 text-xs text-slate-500">
                      勤怠・出面の機能で「本人が自分の記録だけを操作できる」ようにするための設定です。
                    </p>
                    <EmployeeUserLinkSection
                      employeeId={employee.id}
                      linkedUser={linkedUser}
                      candidates={candidateUsers}
                    />
                  </Card>
                )}
                <form action={deleteEmployeeAction}>
                  <input type="hidden" name="id" value={employee.id} />
                  <Button type="submit" variant="danger">
                    この従業員を削除する
                  </Button>
                </form>
              </div>
            ),
          },
          {
            label: "ファイル参照",
            content: (
              <div className="max-w-lg">
                <EntityFileSection entityType="EMPLOYEE" entityId={employee.id} files={files} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
