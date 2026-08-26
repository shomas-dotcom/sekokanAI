import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, Badge } from "@/components/ui";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  REGULAR: "正社員",
  PART_TIME: "パート・アルバイト",
  SUBCONTRACTOR: "一人親方・協力会社",
  OTHER: "その他",
};

export default async function EmployeesPage() {
  const user = await requireUser();
  const employees = await prisma.employee.findMany({
    where: { companyId: user.companyId },
    include: { qualifications: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">従業員管理</h1>
        <Link href="/employees/new">
          <Button>+ 従業員を追加</Button>
        </Link>
      </div>

      {employees.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ従業員が登録されていません。
        </p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">役職</th>
                <th className="px-4 py-3 font-medium">雇用区分</th>
                <th className="px-4 py-3 font-medium">資格</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const expired = e.qualifications.filter((q) => isExpired(q.expiresAt));
                const expiringSoon = e.qualifications.filter((q) => isExpiringSoon(q.expiresAt));
                return (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/employees/${e.id}`} className="font-medium text-orange-700 underline">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.position ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{EMPLOYMENT_TYPE_LABEL[e.employmentType]}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {e.qualifications.length === 0 && <span className="text-slate-400">—</span>}
                        {expired.length > 0 && (
                          <Badge className="bg-rose-100 text-rose-700">期限切れ {expired.length}件</Badge>
                        )}
                        {expiringSoon.length > 0 && (
                          <Badge className="bg-amber-100 text-amber-700">
                            期限間近 {expiringSoon.length}件
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
