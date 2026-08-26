import type { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// 見積受注・契約確定のたびに現場責任者が手でステータスを直す二重入力を無くすため、
// 見積受注(→受注)・契約確定(→施工中)のタイミングで自動的に前進させる。
// 失注(LOST)は終端として扱い、自動では動かさない。完工への移行は現地の完成確認が
// 必要な事実のため、請求・入金からは自動化しない(依頼元の要望どおり手動のまま)。
const STATUS_RANK: Record<ProjectStatus, number> = {
  LEAD: 0,
  ESTIMATING: 1,
  CONTRACTED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  LOST: -1,
};

/** 現在のステータスをminStatusまで前進させる必要があれば、その値を返す。不要ならnull。 */
export function computeAdvancedStatus(
  current: ProjectStatus,
  minStatus: ProjectStatus
): ProjectStatus | null {
  if (current === "LOST") return null;
  return STATUS_RANK[current] < STATUS_RANK[minStatus] ? minStatus : null;
}

export async function advanceProjectStatus(projectId: string, minStatus: ProjectStatus): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
  if (!project) return;

  const next = computeAdvancedStatus(project.status, minStatus);
  if (next) {
    await prisma.project.update({ where: { id: projectId }, data: { status: next } });
  }
}
