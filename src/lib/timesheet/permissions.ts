import { prisma } from "@/lib/prisma";

/**
 * 出面・日報の一次承認ができるかどうかを判定する。管理者は常に可、現場責任者は
 * その現場の担当(ProjectSupervisor)に登録されている場合のみ可。一般社員は不可。
 */
export async function canManageProjectTimesheet(
  user: { id: string; companyId: string; role: string },
  projectId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.role !== "SITE_MANAGER") return false;

  const supervises = await prisma.projectSupervisor.findFirst({
    where: { projectId, userId: user.id },
  });
  return Boolean(supervises);
}

/** 現場責任者が担当している現場IDの一覧を取得する。 */
export async function getSupervisedProjectIds(userId: string): Promise<string[]> {
  const rows = await prisma.projectSupervisor.findMany({ where: { userId }, select: { projectId: true } });
  return rows.map((r) => r.projectId);
}
