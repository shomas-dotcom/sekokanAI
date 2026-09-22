import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Textarea, Button } from "@/components/ui";
import { rejectAttendanceAction } from "../../actions";

export default async function RejectAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const admin = await requireAdmin();

  const attendance = await prisma.attendance.findFirst({
    where: { id, companyId: admin.companyId },
    include: { employee: { select: { name: true } } },
  });
  if (!attendance) notFound();

  return (
    <Card className="max-w-md">
      <h1 className="mb-3 text-lg font-bold text-slate-900">勤怠の差し戻し</h1>
      <p className="mb-3 text-sm text-slate-600">
        {attendance.employee.name} / {attendance.targetDate.toLocaleDateString("ja-JP")}
      </p>
      {error === "reason_required" && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">差し戻し理由を入力してください。</p>
      )}
      <form action={rejectAttendanceAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={attendance.id} />
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          差し戻し理由(本人に表示されます)
          <Textarea name="reason" rows={3} required />
        </label>
        <Button type="submit" variant="danger">
          差し戻す
        </Button>
      </form>
    </Card>
  );
}
