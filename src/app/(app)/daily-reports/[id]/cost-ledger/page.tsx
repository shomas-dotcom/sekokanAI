import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Button } from "@/components/ui";
import {
  addLaborEntryAction,
  deleteLaborEntryAction,
  addOwnItemAction,
  deleteOwnItemAction,
  addPartnerItemAction,
  deletePartnerItemAction,
} from "./actions";

export default async function CostLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      laborEntries: { orderBy: { sortOrder: "asc" } },
      ownItems: { orderBy: { sortOrder: "asc" } },
      partnerItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) notFound();

  const vehicles = report.ownItems.filter((i) => i.kind === "VEHICLE_MACHINERY");
  const ownMaterials = report.ownItems.filter((i) => i.kind === "MATERIAL");
  const partnerEquipment = report.partnerItems.filter((i) => i.kind === "PARTNER_EQUIPMENT");
  const otherExpenses = report.partnerItems.filter((i) => i.kind === "OTHER_EXPENSE");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">原価集計表の明細入力</h1>
        <p className="mt-1 text-sm text-slate-500">
          {report.reportDate.toLocaleDateString("ja-JP")} / {report.project.customer.name} / {report.project.name}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          単価(日当)等は給与相当の機微情報のため、この画面では音声入力を使わず手入力のみとしています。
        </p>
        <a
          href={`/daily-reports/${report.id}/cost-ledger-xlsx`}
          className="mt-3 inline-flex rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          原価集計表をExcelでダウンロード
        </a>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">氏名・単価・残業・職種</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-2">氏名</th>
              <th className="py-1 pr-2">単価</th>
              <th className="py-1 pr-2">残業(h)</th>
              <th className="py-1 pr-2">職種</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {report.laborEntries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="py-1 pr-2">{e.workerName}</td>
                <td className="py-1 pr-2">{e.unitPrice?.toLocaleString("ja-JP") ?? "—"}</td>
                <td className="py-1 pr-2">{e.overtimeHours ?? "—"}</td>
                <td className="py-1 pr-2">{e.jobType ?? "—"}</td>
                <td className="py-1">
                  <form action={deleteLaborEntryAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="dailyReportId" value={report.id} />
                    <button type="submit" className="text-xs text-rose-600 underline">
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={addLaborEntryAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="dailyReportId" value={report.id} />
          <Input name="workerName" placeholder="氏名" className="w-32" />
          <Input name="unitPrice" type="number" placeholder="単価" className="w-24" />
          <Input name="overtimeHours" type="number" step="0.5" placeholder="残業(h)" className="w-24" />
          <Input name="jobType" placeholder="職種" className="w-28" />
          <Button type="submit" variant="secondary">
            + 追加
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">自社持込車両・機械 / 自社持込材料</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">自社持込車両・機械</p>
            {vehicles.map((i) => (
              <div key={i.id} className="mt-1 flex items-center justify-between text-sm">
                <span>
                  {i.name} {i.quantity ?? ""} {i.amount ? `${i.amount.toLocaleString("ja-JP")}円` : ""}
                </span>
                <form action={deleteOwnItemAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="dailyReportId" value={report.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            ))}
            <form action={addOwnItemAction} className="mt-2 flex flex-wrap gap-1.5">
              <input type="hidden" name="dailyReportId" value={report.id} />
              <input type="hidden" name="kind" value="VEHICLE_MACHINERY" />
              <Input name="name" placeholder="名称" className="w-24" />
              <Input name="quantity" placeholder="数量" className="w-16" />
              <Input name="amount" type="number" placeholder="金額" className="w-20" />
              <Button type="submit" variant="secondary">
                +
              </Button>
            </form>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">自社持込材料</p>
            {ownMaterials.map((i) => (
              <div key={i.id} className="mt-1 flex items-center justify-between text-sm">
                <span>
                  {i.name} {i.quantity ?? ""} {i.amount ? `${i.amount.toLocaleString("ja-JP")}円` : ""}
                </span>
                <form action={deleteOwnItemAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="dailyReportId" value={report.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            ))}
            <form action={addOwnItemAction} className="mt-2 flex flex-wrap gap-1.5">
              <input type="hidden" name="dailyReportId" value={report.id} />
              <input type="hidden" name="kind" value="MATERIAL" />
              <Input name="name" placeholder="名称" className="w-24" />
              <Input name="quantity" placeholder="数量" className="w-16" />
              <Input name="amount" type="number" placeholder="金額" className="w-20" />
              <Button type="submit" variant="secondary">
                +
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">協力会社持込資機材 / その他経費</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">協力会社持込資機材</p>
            {partnerEquipment.map((i) => (
              <div key={i.id} className="mt-1 flex items-center justify-between text-sm">
                <span>
                  {i.name} {i.quantity ?? ""} {i.unitPrice ? `${i.unitPrice.toLocaleString("ja-JP")}円` : ""}
                </span>
                <form action={deletePartnerItemAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="dailyReportId" value={report.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            ))}
            <form action={addPartnerItemAction} className="mt-2 flex flex-wrap gap-1.5">
              <input type="hidden" name="dailyReportId" value={report.id} />
              <input type="hidden" name="kind" value="PARTNER_EQUIPMENT" />
              <Input name="name" placeholder="名称" className="w-24" />
              <Input name="quantity" placeholder="数量" className="w-16" />
              <Input name="unitPrice" type="number" placeholder="単価" className="w-20" />
              <Button type="submit" variant="secondary">
                +
              </Button>
            </form>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">その他経費</p>
            {otherExpenses.map((i) => (
              <div key={i.id} className="mt-1 flex items-center justify-between text-sm">
                <span>
                  {i.name} {i.quantity ?? ""} {i.unitPrice ? `${i.unitPrice.toLocaleString("ja-JP")}円` : ""}
                </span>
                <form action={deletePartnerItemAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="dailyReportId" value={report.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            ))}
            <form action={addPartnerItemAction} className="mt-2 flex flex-wrap gap-1.5">
              <input type="hidden" name="dailyReportId" value={report.id} />
              <input type="hidden" name="kind" value="OTHER_EXPENSE" />
              <Input name="name" placeholder="名称" className="w-24" />
              <Input name="quantity" placeholder="数量" className="w-16" />
              <Input name="unitPrice" type="number" placeholder="単価" className="w-20" />
              <Button type="submit" variant="secondary">
                +
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
