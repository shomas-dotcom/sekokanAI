import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  const user = await requireUser();
  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">顧客管理</h1>
        <Link
          href="/customers/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + 顧客を追加
        </Link>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          まだ顧客が登録されていません。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">顧客名</th>
                <th className="px-4 py-2 font-medium">担当者</th>
                <th className="px-4 py-2 font-medium">電話番号</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-zinc-900 underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{c.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
