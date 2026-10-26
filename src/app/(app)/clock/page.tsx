import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { formatJstTime } from "@/lib/timesheet/time";
import { CLOCK_PROJECT_STATUSES, jstTargetDate } from "@/lib/timesheet/clock";
import { ClockPanel } from "./ClockPanel";

export default async function ClockPage() {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <Card className="mx-auto max-w-md">
        <p className="text-sm text-slate-700">
          ログイン利用者と従業員マスタが関連付けられていないため、打刻できません。管理者に、従業員詳細画面から関連付けを行ってもらってください。
        </p>
      </Card>
    );
  }

  const today = jstTargetDate(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [projects, recent, lastWithProject] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: user.companyId, status: { in: CLOCK_PROJECT_STATUSES } },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.attendance.findMany({
      where: { employeeId: user.employeeId, companyId: user.companyId, targetDate: { in: [today, yesterday] } },
      include: { project: { select: { name: true } } },
      orderBy: { targetDate: "desc" },
    }),
    prisma.attendance.findFirst({
      where: { employeeId: user.employeeId, companyId: user.companyId, projectId: { not: null } },
      orderBy: { targetDate: "desc" },
      select: { projectId: true },
    }),
  ]);

  const todayRecord = recent.find((r) => r.targetDate.getTime() === today.getTime()) ?? null;
  // 夜勤で日付をまたいだ場合は、昨日の出勤済み・未退勤の勤怠を退勤の対象にする
  const openRecord = recent.find((r) => r.clockInPunched && !r.clockOutPunched) ?? null;
  const editable = (r: { status: string }) => r.status === "DRAFT" || r.status === "REJECTED";

  const canClockIn = !todayRecord || (!todayRecord.clockInPunched && editable(todayRecord));
  const canClockOut = !!openRecord && editable(openRecord);

  // 前回の現場がまだ「今の案件」にあれば、それを最初から選んでおく
  const lastProjectId = lastWithProject?.projectId;
  const defaultProjectId =
    lastProjectId && projects.some((p) => p.id === lastProjectId) ? lastProjectId : (projects[0]?.id ?? "");

  const shown = openRecord ?? todayRecord;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">勤怠</h1>

      <Card>
        <ClockPanel
          projects={projects}
          defaultProjectId={defaultProjectId}
          canClockIn={canClockIn}
          canClockOut={canClockOut}
        />
      </Card>

      <Card>
        <p className="text-sm font-medium text-slate-500">
          {shown ? `${shown.targetDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} の記録` : "今日の記録"}
        </p>
        {shown ? (
          <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">出勤</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatJstTime(shown.clockInTime) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">退勤</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatJstTime(shown.clockOutTime) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">現場</dt>
              <dd className="font-medium text-slate-900">{shown.project?.name ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">まだ打刻していません。</p>
        )}
      </Card>

      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/attendance" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          自分の勤怠(修正・提出)
        </Link>
        <a href="/attendance/pdf" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50">
          今月の出勤簿PDF
        </a>
      </div>
    </div>
  );
}
