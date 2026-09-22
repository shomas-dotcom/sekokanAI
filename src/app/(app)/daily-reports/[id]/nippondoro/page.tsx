import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Button } from "@/components/ui";
import {
  addWorkTypeEntryAction,
  deleteWorkTypeEntryAction,
  addMaterialEntryAction,
  deleteMaterialEntryAction,
  addMachineryEntryAction,
  deleteMachineryEntryAction,
} from "./actions";

export default async function NippondoroReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      workTypeEntries: { orderBy: { sortOrder: "asc" } },
      materialEntries: { orderBy: { sortOrder: "asc" } },
      machineryEntries: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) notFound();
  if (report.project.reportFormat !== "NIPPON_DORO_KOCHO") notFound();

  // 累計は別ファイル参照ではなく、同一案件の過去日報分をDBから合計して算出する
  // (costLedgerXlsx.tsの累計金額と同じ考え方)。
  const priorWorkTypeAgg = await prisma.dailyReportWorkTypeEntry.groupBy({
    by: ["workType", "subItem"],
    where: { dailyReport: { projectId: report.projectId, reportDate: { lt: report.reportDate } } },
    _sum: { dailyQuantity: true, dailyWorkerCount: true },
  });
  const cumulativeByWorkType = new Map(
    priorWorkTypeAgg.map((a) => [
      `${a.workType}::${a.subItem ?? ""}`,
      { quantity: a._sum.dailyQuantity ?? 0, workerCount: a._sum.dailyWorkerCount ?? 0 },
    ])
  );
  const priorMaterialAgg = await prisma.dailyReportMaterialEntry.groupBy({
    by: ["name"],
    where: { dailyReport: { projectId: report.projectId, reportDate: { lt: report.reportDate } } },
    _sum: { dailyQuantity: true },
  });
  const cumulativeByMaterial = new Map(priorMaterialAgg.map((a) => [a.name, a._sum.dailyQuantity ?? 0]));
  const priorMachineryAgg = await prisma.dailyReportMachineryEntry.groupBy({
    by: ["machineType", "spec"],
    where: { dailyReport: { projectId: report.projectId, reportDate: { lt: report.reportDate } } },
    _sum: { dailyCount: true },
  });
  const cumulativeByMachinery = new Map(
    priorMachineryAgg.map((a) => [`${a.machineType}::${a.spec ?? ""}`, a._sum.dailyCount ?? 0])
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">工事日報(日本道路株式会社 指定様式)</h1>
        <p className="mt-1 text-sm text-slate-500">
          {report.reportDate.toLocaleDateString("ja-JP")} / {report.project.customer.name} / {report.project.name}
          {report.project.siteAbbreviation && `(略称: ${report.project.siteAbbreviation})`}
        </p>
        <a
          href={`/daily-reports/${report.id}/nippondoro-xlsx`}
          className="mt-3 inline-flex rounded-full bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          指定様式をExcelでダウンロード
        </a>
      </div>

      <Card>
        <h2 className="font-semibold text-slate-900">工種・出来高・作業人員・外部提供者</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">工種</th>
                <th className="py-1 pr-2">細目</th>
                <th className="py-1 pr-2">単位</th>
                <th className="py-1 pr-2">出来高(日計/累計)</th>
                <th className="py-1 pr-2">人員(日計/累計)</th>
                <th className="py-1 pr-2">外部提供者</th>
                <th className="py-1 pr-2">単価</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {report.workTypeEntries.map((e) => {
                const cum = cumulativeByWorkType.get(`${e.workType}::${e.subItem ?? ""}`);
                const cumQuantity = (cum?.quantity ?? 0) + (e.dailyQuantity ?? 0);
                const cumWorkers = (cum?.workerCount ?? 0) + (e.dailyWorkerCount ?? 0);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{e.workType}</td>
                    <td className="py-1 pr-2">{e.subItem ?? "—"}</td>
                    <td className="py-1 pr-2">{e.unit ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {e.dailyQuantity ?? "—"} / {cumQuantity || "—"}
                    </td>
                    <td className="py-1 pr-2">
                      {e.dailyWorkerCount ?? "—"} / {cumWorkers || "—"}
                    </td>
                    <td className="py-1 pr-2">{e.externalProviderName ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {e.externalProviderQuantity ?? "—"} × {e.externalProviderUnitPrice?.toLocaleString("ja-JP") ?? "—"}
                    </td>
                    <td className="py-1">
                      <form action={deleteWorkTypeEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dailyReportId" value={report.id} />
                        <button type="submit" className="text-xs text-rose-600 underline">
                          削除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={addWorkTypeEntryAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="dailyReportId" value={report.id} />
          <Input name="workType" placeholder="工種" className="w-28" />
          <Input name="subItem" placeholder="細目" className="w-28" />
          <Input name="workArea" placeholder="施工範囲" className="w-24" />
          <Input name="unit" placeholder="単位" className="w-16" />
          <Input name="dailyQuantity" type="number" step="0.01" placeholder="出来高(日計)" className="w-24" />
          <Input name="dailyWorkerCount" type="number" placeholder="人員(日計)" className="w-20" />
          <Input name="externalProviderName" placeholder="外部提供者" className="w-28" />
          <Input name="externalProviderQuantity" type="number" step="0.01" placeholder="発注数量" className="w-20" />
          <Input name="externalProviderUnitPrice" type="number" placeholder="単価" className="w-24" />
          <Button type="submit" variant="secondary">
            + 追加
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">使用材料</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">品名</th>
                <th className="py-1 pr-2">規格</th>
                <th className="py-1 pr-2">単位</th>
                <th className="py-1 pr-2">搬入量(日計/累計)</th>
                <th className="py-1 pr-2">受入検査</th>
                <th className="py-1 pr-2">外部提供者</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {report.materialEntries.map((e) => {
                const cumQuantity = (cumulativeByMaterial.get(e.name) ?? 0) + (e.dailyQuantity ?? 0);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{e.name}</td>
                    <td className="py-1 pr-2">{e.spec ?? "—"}</td>
                    <td className="py-1 pr-2">{e.unit ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {e.dailyQuantity ?? "—"} / {cumQuantity || "—"}
                    </td>
                    <td className="py-1 pr-2">{e.inspectionResult ?? "—"}</td>
                    <td className="py-1 pr-2">{e.supplierName ?? "—"}</td>
                    <td className="py-1">
                      <form action={deleteMaterialEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dailyReportId" value={report.id} />
                        <button type="submit" className="text-xs text-rose-600 underline">
                          削除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={addMaterialEntryAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="dailyReportId" value={report.id} />
          <Input name="name" placeholder="品名" className="w-28" />
          <Input name="spec" placeholder="規格" className="w-20" />
          <Input name="unit" placeholder="単位" className="w-16" />
          <Input name="dailyQuantity" type="number" step="0.01" placeholder="搬入量" className="w-24" />
          <Input name="inspectionResult" placeholder="合/否" className="w-16" />
          <Input name="supplierName" placeholder="外部提供者" className="w-28" />
          <Input name="remarks" placeholder="備考" className="w-28" />
          <Button type="submit" variant="secondary">
            + 追加
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">使用機械</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 pr-2">機種</th>
                <th className="py-1 pr-2">規格</th>
                <th className="py-1 pr-2">運転手</th>
                <th className="py-1 pr-2">台数(日計/累計)</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {report.machineryEntries.map((e) => {
                const cumCount = (cumulativeByMachinery.get(`${e.machineType}::${e.spec ?? ""}`) ?? 0) + (e.dailyCount ?? 0);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-1 pr-2">{e.machineType}</td>
                    <td className="py-1 pr-2">{e.spec ?? "—"}</td>
                    <td className="py-1 pr-2">{e.operatorName ?? "—"}</td>
                    <td className="py-1 pr-2">
                      {e.dailyCount ?? "—"} / {cumCount || "—"}
                    </td>
                    <td className="py-1">
                      <form action={deleteMachineryEntryAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dailyReportId" value={report.id} />
                        <button type="submit" className="text-xs text-rose-600 underline">
                          削除
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form action={addMachineryEntryAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="dailyReportId" value={report.id} />
          <Input name="machineType" placeholder="機種(例: BH)" className="w-28" />
          <Input name="spec" placeholder="規格(例: 0.7)" className="w-24" />
          <Input name="operatorName" placeholder="運転手" className="w-28" />
          <Input name="dailyCount" type="number" step="0.01" placeholder="台数(日計)" className="w-24" />
          <Button type="submit" variant="secondary">
            + 追加
          </Button>
        </form>
      </Card>
    </div>
  );
}
