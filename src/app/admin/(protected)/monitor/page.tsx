import { prisma } from "@/lib/prisma";
import { Card, Input, Label, Badge, Button } from "@/components/ui";
import { getOrCreateMonitorProgram, isMonitorPeriodActive, monitorFreeUntil } from "@/lib/monitor";
import { updateMonitorProgramAction } from "./actions";

/** UTCのDateを、datetime-local入力欄用の"YYYY-MM-DDTHH:mm"(日本時間)にする。 */
function toJstLocalInputValue(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function jstDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export default async function AdminMonitorPage() {
  const [program, usedCount, companies] = await Promise.all([
    getOrCreateMonitorProgram(),
    prisma.company.count({ where: { isMonitor: true } }),
    prisma.company.findMany({
      where: { isMonitor: true },
      orderBy: { monitorEnrolledAt: "asc" },
      select: { id: true, name: true, monitorEnrolledAt: true, monitorFreeMonths: true, isSuspended: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">モニター募集(30社限定・6か月無料)</h1>
        <p className="mt-1 text-sm text-slate-500">
          登録画面(/register)・Google新規登録で共通して使う設定です。日時はすべて日本時間で表示・入力します。
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">現況</p>
          <Badge className={usedCount >= program.capacity ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}>
            {usedCount} / {program.capacity} 社
          </Badge>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">設定</h2>
        <form action={updateMonitorProgramAction} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="enabled" defaultChecked={program.enabled} />
            受付を有効にする(開始日時を過ぎていても、これがオフの間は受付停止中として案内する)
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Label>
              受付開始日時(日本時間)
              <Input type="datetime-local" name="startsAt" defaultValue={toJstLocalInputValue(program.startsAt)} required />
            </Label>
            <Label>
              募集枠数
              <Input type="number" name="capacity" min={1} defaultValue={program.capacity} required />
            </Label>
            <Label>
              無料期間(暦月)
              <Input type="number" name="freeMonths" min={1} defaultValue={program.freeMonths} required />
            </Label>
          </div>
          <p className="text-xs text-slate-400">
            無料期間の月数は、変更しても既にモニター登録済みの会社には遡って適用されません(登録時点の値を各社ごとに固定しています)。
          </p>
          <Button type="submit" className="w-fit">
            保存
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">モニター登録会社一覧({companies.length}社)</h2>
        {companies.length === 0 ? (
          <p className="text-sm text-slate-500">まだ登録がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="pb-2 pr-3">会社名</th>
                  <th className="pb-2 pr-3">登録日</th>
                  <th className="pb-2 pr-3">無料期限</th>
                  <th className="pb-2 pr-3">状態</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const active = isMonitorPeriodActive({
                    isMonitor: true,
                    monitorEnrolledAt: c.monitorEnrolledAt,
                    monitorFreeMonths: c.monitorFreeMonths,
                  });
                  const until = monitorFreeUntil({
                    isMonitor: true,
                    monitorEnrolledAt: c.monitorEnrolledAt,
                    monitorFreeMonths: c.monitorFreeMonths,
                  });
                  return (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">
                        {c.name}
                        {c.isSuspended && <Badge className="ml-2 bg-slate-200 text-slate-500">利用停止</Badge>}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{jstDate(c.monitorEnrolledAt)}</td>
                      <td className="py-2 pr-3 text-slate-600">{jstDate(until)}</td>
                      <td className="py-2 pr-3">
                        <Badge className={active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}>
                          {active ? "無料期間中" : "終了"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
