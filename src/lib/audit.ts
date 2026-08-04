import { prisma } from "@/lib/prisma";

export async function logAction(params: {
  companyId: string;
  userId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
}) {
  await prisma.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
    },
  });
}
