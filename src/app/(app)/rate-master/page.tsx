import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card } from "@/components/ui";
import { RATE_CATEGORY_LABEL } from "@/lib/rateMaster";

export default async function RateMasterPage() {
  const user = await requireUser();
  const items = await prisma.rateMasterItem.findMany({
    where: { companyId: user.companyId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">単価マスタ</h1>
          <p className="mt-1 text-sm text-slate-500">
            ここに登録した単価を、AI見積の下書き作成時に優先して使います。登録がない品目は「単価不明」として一覧に残ります。
          </p>
        </div>
        <Link href="/rate-master/new">
          <Button>+ 単価を追加</Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          まだ単価が登録されていません。
        </p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">区分</th>
                <th className="px-4 py-3 font-medium">品目名</th>
                <th className="px-4 py-3 font-medium">単位</th>
                <th className="px-4 py-3 font-medium">売単価</th>
                <th className="px-4 py-3 font-medium">原価</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{RATE_CATEGORY_LABEL[item.category]}</td>
                  <td className="px-4 py-3">
                    <Link href={`/rate-master/${item.id}`} className="font-medium text-orange-700 underline">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                  <td className="px-4 py-3 text-slate-900">{item.unitPrice.toLocaleString("ja-JP")}円</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.costPrice != null ? `${item.costPrice.toLocaleString("ja-JP")}円` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
