import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSiteAttendanceXlsx } from "@/lib/xlsx/siteAttendanceXlsx";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const projectId = searchParams.get("projectId");

  const now = new Date();
  const [y, m] = (monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    .split("-")
    .map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, -9, 0));
  const monthEnd = new Date(Date.UTC(y, m, 1, -9, 0));

  const [laborRecords, expenseRecords] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: {
        companyId: admin.companyId,
        targetDate: { gte: monthStart, lt: monthEnd },
        ...(projectId ? { projectId } : {}),
      },
      include: { project: { select: { name: true, primeContractorName: true } } },
      orderBy: [{ targetDate: "asc" }],
    }),
    prisma.siteExpenseEntry.findMany({
      where: {
        companyId: admin.companyId,
        targetDate: { gte: monthStart, lt: monthEnd },
        ...(projectId ? { projectId } : {}),
      },
      include: { project: { select: { name: true } } },
      orderBy: [{ targetDate: "asc" }],
    }),
  ]);

  const categoryLabel: Record<string, string> = {
    VEHICLE: "車両",
    MACHINERY: "重機",
    MATERIAL: "材料",
    TRANSPORT: "回送",
    TRAVEL_EXPENSE: "交通費",
    OTHER: "その他",
  };

  const buffer = await buildSiteAttendanceXlsx({
    companyName: admin.company.name,
    periodLabel: `${y}年${String(m).padStart(2, "0")}月`,
    laborRows: laborRecords.map((r) => ({
      primeContractorName: r.project.primeContractorName,
      projectName: r.project.name,
      targetDate: r.targetDate,
      workerName: r.workerName,
      jobType: r.jobType,
      workContent: r.workContent,
      manDays: r.manDays,
      isBillable: r.isBillable,
      isCostTarget: r.isCostTarget,
      manDayUnitPrice: r.manDayUnitPrice,
      laborCostUnitPrice: r.laborCostUnitPrice,
    })),
    expenseRows: expenseRecords.map((e) => ({
      projectName: e.project.name,
      targetDate: e.targetDate,
      category: categoryLabel[e.category] ?? e.category,
      name: e.name,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      amount: e.amount,
    })),
  });

  const filename = `${admin.company.name}_出面集計表_${y}年${String(m).padStart(2, "0")}月.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
