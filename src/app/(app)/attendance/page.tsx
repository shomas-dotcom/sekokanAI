import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Select, Button } from "@/components/ui";
import { updateMyAttendanceAction, submitMyAttendanceAction } from "./actions";
import { formatJstTime } from "@/lib/timesheet/time";
import Link from "next/link";

const CATEGORY_LABEL: Record<string, string> = {
  NORMAL: "通常勤務",
  HOLIDAY_WORK: "休日出勤",
  PAID_LEAVE: "有給",
  HALF_DAY_LEAVE: "半休",
  ABSENCE: "欠勤",
  LATE: "遅刻",
  EARLY_LEAVE: "早退",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  APPROVED: "承認済み",
  REJECTED: "差し戻し",
  CLOSED: "締め済み",
};

function minutesToHours(minutes: number | null): string {
  if (minutes == null) return "—";
  return (minutes / 60).toFixed(1);
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const user = await requireUser();

  const now = new Date();
  const [y, m] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0)); // その月1日のJST0時
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const nextMonth = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  if (!user.employeeId) {
    return (
      <Card className="max-w-xl">
        <p className="text-sm text-slate-700">
          ログイン利用者と従業員マスタが関連付けられていないため、勤怠を表示できません。管理者に、従業員詳細画面から関連付けを行ってもらってください。
        </p>
      </Card>
    );
  }

  const records = await prisma.attendance.findMany({
    where: { employeeId: user.employeeId, companyId: user.companyId, targetDate: { gte: monthStart, lt: monthEnd } },
    orderBy: { targetDate: "asc" },
  });

  const totalActual = records.reduce((sum, r) => sum + (r.actualWorkMinutes ?? 0), 0);
  const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeMinutes ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">自分の勤怠({y}年{m}月)</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/attendance?month=${prevMonth}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            前月
          </Link>
          <Link href={`/attendance?month=${nextMonth}`} className="rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
            翌月
          </Link>
        </div>
      </div>

      <Card className="max-w-xl">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">今月の実働時間(合計)</dt>
            <dd className="font-medium text-slate-900">{minutesToHours(totalActual)}時間</dd>
          </div>
          <div>
            <dt className="text-slate-500">今月の残業時間(合計)</dt>
            <dd className="font-medium text-slate-900">{minutesToHours(totalOvertime)}時間</dd>
          </div>
        </dl>
      </Card>

      {records.length === 0 && (
        <Card className="max-w-xl">
          <p className="text-sm text-slate-500">この月の勤怠記録はまだありません(日報に作業員として登録されると自動で作られます)。</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {records.map((r) => {
          const editable = r.status === "DRAFT" || r.status === "REJECTED";
          return (
            <Card key={r.id} className="max-w-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{r.targetDate.toLocaleDateString("ja-JP")}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              {r.status === "REJECTED" && r.rejectionReason && (
                <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
                  差し戻し理由: {r.rejectionReason}
                </p>
              )}
              {editable ? (
                <form action={updateMyAttendanceAction} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      出勤
                      <Input name="clockInTime" type="time" defaultValue={formatJstTime(r.clockInTime)} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      退勤
                      <Input name="clockOutTime" type="time" defaultValue={formatJstTime(r.clockOutTime)} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      休憩(分)
                      <Input name="breakMinutes" type="number" defaultValue={r.breakMinutes} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600">
                      勤務区分
                      <Select name="workCategory" defaultValue={r.workCategory}>
                        {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-slate-600">
                    備考
                    <Input name="remarks" defaultValue={r.remarks ?? ""} />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" variant="secondary">
                      修正を保存
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">出勤〜退勤</dt>
                    <dd className="text-slate-800">
                      {formatJstTime(r.clockInTime) || "—"}〜{formatJstTime(r.clockOutTime) || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">勤務区分</dt>
                    <dd className="text-slate-800">{CATEGORY_LABEL[r.workCategory]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">実働 / 残業</dt>
                    <dd className="text-slate-800">
                      {minutesToHours(r.actualWorkMinutes)}h / {minutesToHours(r.overtimeMinutes)}h
                    </dd>
                  </div>
                </dl>
              )}
              {editable && (
                <form action={submitMyAttendanceAction} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit">この内容で提出する</Button>
                </form>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
