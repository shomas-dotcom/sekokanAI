import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "../ProjectForm";
import { updateProjectAction, deleteProjectAction, updateProjectMembersAction } from "../actions";
import { Card, Button } from "@/components/ui";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [project, customers, quotes, contracts, invoices, employees, members] = await Promise.all([
    prisma.project.findFirst({ where: { id, companyId: user.companyId } }),
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.quote.findMany({ where: { projectId: id, companyId: user.companyId }, orderBy: { createdAt: "desc" } }),
    prisma.contract.findMany({ where: { projectId: id, companyId: user.companyId }, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where: { projectId: id, companyId: user.companyId }, orderBy: { createdAt: "desc" } }),
    prisma.employee.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    prisma.projectMember.findMany({ where: { projectId: id }, select: { employeeId: true } }),
  ]);
  if (!project) notFound();
  const assignedEmployeeIds = new Set(members.map((m) => m.employeeId));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
      <Card className="max-w-lg">
        <ProjectForm
          action={updateProjectAction}
          project={project}
          customers={customers}
          submitLabel="更新する"
        />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">この案件の書類(簡易工事台帳)</h2>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <DocList
            title="見積"
            items={quotes.map((q) => ({ id: q.id, label: q.title, href: `/quotes/${q.id}` }))}
            newHref="/quotes/new"
          />
          <DocList
            title="契約書"
            items={contracts.map((c) => ({
              id: c.id,
              label: c.contractNumber,
              href: `/contracts/${c.id}`,
            }))}
            newHref="/contracts/new"
          />
          <DocList
            title="請求書"
            items={invoices.map((i) => ({
              id: i.id,
              label: i.invoiceNumber,
              href: `/invoices/${i.id}`,
            }))}
            newHref="/invoices/new"
          />
        </div>
      </Card>

      <Card className="max-w-lg">
        <h2 className="font-semibold text-slate-900">作業員</h2>
        {employees.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            まだ従業員が登録されていません。
            <Link href="/employees/new" className="ml-1 text-orange-700 underline">
              従業員を登録する
            </Link>
          </p>
        ) : (
          <form action={updateProjectMembersAction} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="flex flex-col gap-1.5">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="employeeId"
                    value={emp.id}
                    defaultChecked={assignedEmployeeIds.has(emp.id)}
                    className="accent-amber-600"
                  />
                  {emp.name}
                  {emp.position && <span className="text-slate-400">({emp.position})</span>}
                </label>
              ))}
            </div>
            <Button type="submit" variant="secondary" className="w-fit">
              保存する
            </Button>
          </form>
        )}
      </Card>

      <form action={deleteProjectAction} className="max-w-lg">
        <input type="hidden" name="id" value={project.id} />
        <Button type="submit" variant="danger">
          この案件を削除する
        </Button>
      </form>
    </div>
  );
}

function DocList({
  title,
  items,
  newHref,
}: {
  title: string;
  items: { id: string; label: string; href: string }[];
  newHref: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <Link href={newHref} className="text-xs font-medium text-orange-700 underline">
          + 作成
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">まだありません</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="text-sm text-slate-700 underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
