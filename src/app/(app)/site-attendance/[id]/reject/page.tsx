import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Textarea, Button } from "@/components/ui";
import { rejectSiteAttendanceAction } from "../../actions";
import { canManageProjectTimesheet } from "@/lib/timesheet/permissions";

export default async function RejectSiteAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  const record = await prisma.siteAttendance.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { select: { name: true } } },
  });
  if (!record) notFound();
  if (!(await canManageProjectTimesheet(user, record.projectId))) redirect("/site-attendance");

  return (
    <Card className="max-w-md">
      <h1 className="mb-3 text-lg font-bold text-slate-900">出面の差し戻し</h1>
      <p className="mb-3 text-sm text-slate-600">
        {record.workerName} / {record.project.name} / {record.targetDate.toLocaleDateString("ja-JP")}
      </p>
      {error === "reason_required" && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">差し戻し理由を入力してください。</p>
      )}
      <form action={rejectSiteAttendanceAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={record.id} />
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          差し戻し理由
          <Textarea name="reason" rows={3} required />
        </label>
        <Button type="submit" variant="danger">
          差し戻す
        </Button>
      </form>
    </Card>
  );
}
