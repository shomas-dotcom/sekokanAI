import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">顧客管理</h1>
        <Link href="/customers/new">
          <Button>+ 顧客を追加</Button>
        </Link>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ顧客が登録されていません。
        </p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">顧客名</th>
                <th className="px-4 py-3 font-medium">担当者</th>
                <th className="px-4 py-3 font-medium">電話番号</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-orange-700 underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
