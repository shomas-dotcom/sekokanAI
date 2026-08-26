import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";

export default async function WorkItemsPage() {
  const user = await requireUser();
  const workItems = await prisma.workItemMaster.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">作業内容マスタ</h1>
          <p className="mt-1 text-sm text-slate-500">
            日報の作業内容入力欄で候補として表示される、よく使う作業内容の一覧です。
          </p>
        </div>
        <Link href="/work-items/new">
          <Button>+ 作業内容を追加</Button>
        </Link>
      </div>

      {workItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ作業内容が登録されていません。例: 掘削・砕石・型枠・配筋・コンクリート・舗装・ブロック積み・フェンス・土間・残土処分
        </p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">作業内容</th>
                <th className="px-4 py-3 font-medium">表示順</th>
              </tr>
            </thead>
            <tbody>
              {workItems.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/work-items/${w.id}`} className="font-medium text-orange-700 underline">
                      {w.label}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{w.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
