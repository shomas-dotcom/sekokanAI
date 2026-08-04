import type { ProjectStatus } from "@/generated/prisma/enums";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  LEAD: "見込み",
  ESTIMATING: "見積中",
  CONTRACTED: "受注",
  IN_PROGRESS: "施工中",
  COMPLETED: "完工",
  LOST: "失注",
};
