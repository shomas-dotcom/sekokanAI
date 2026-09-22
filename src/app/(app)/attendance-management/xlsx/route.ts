import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAttendanceXlsx } from "@/lib/xlsx/attendanceXlsx";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const employeeId = searchParams.get("employeeId");

  const now = new Date();
  const [y, m] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));

  const records = await prisma.attendance.findMany({
    where: {
      companyId: admin.companyId,
      targetDate: { gte: monthStart, lt: monthEnd },
      ...(employeeId ? { employeeId } : {}),
    },
    include: { employee: { select: { name: true } } },
    orderBy: [{ employee: { name: "asc" } }, { targetDate: "asc" }],
  });

  const buffer = await buildAttendanceXlsx({
    companyName: admin.company.name,
    yearMonthLabel: `${y}年${String(m).padStart(2, "0")}月`,
    rows: records.map((r) => ({
      employeeName: r.employee.name,
      targetDate: r.targetDate,
      clockInTime: r.clockInTime,
      clockOutTime: r.clockOutTime,
      breakMinutes: r.breakMinutes,
      actualWorkMinutes: r.actualWorkMinutes,
      normalWorkMinutes: r.normalWorkMinutes,
      overtimeMinutes: r.overtimeMinutes,
      nightShiftMinutes: r.nightShiftMinutes,
      holidayWorkMinutes: r.holidayWorkMinutes,
      isPaidLeave: r.isPaidLeave,
      isAbsence: r.isAbsence,
      remarks: r.remarks,
    })),
  });

  const filename = `${admin.company.name}_勤怠表_${y}年${String(m).padStart(2, "0")}月.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
