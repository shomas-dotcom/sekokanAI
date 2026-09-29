"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonitorProgram } from "@/lib/monitor";

async function logAdminAction(adminId: string, action: string) {
  await prisma.platformAdminAuditLog.create({ data: { adminId, action } });
}

/** datetime-local(JSTのつもりで入力された "YYYY-MM-DDTHH:mm")をUTCのDateにする。 */
function jstLocalInputToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - 9 * 60 * 60 * 1000;
  return new Date(utcMs);
}

export async function updateMonitorProgramAction(formData: FormData): Promise<void> {
  const admin = await requirePlatformAdmin();
  await getOrCreateMonitorProgram(); // 未作成なら既定値で作ってから更新する

  const enabled = formData.get("enabled") === "on";
  const capacityRaw = Number(formData.get("capacity"));
  const freeMonthsRaw = Number(formData.get("freeMonths"));
  const startsAtRaw = String(formData.get("startsAt") ?? "");

  const startsAt = jstLocalInputToUtc(startsAtRaw);
  if (!startsAt) return; // 不正な日時は何もしない(フォーム側でrequired指定済み)
  const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 30;
  const freeMonths = Number.isInteger(freeMonthsRaw) && freeMonthsRaw > 0 ? freeMonthsRaw : 6;

  await prisma.monitorProgram.update({
    where: { id: "singleton" },
    data: { enabled, capacity, freeMonths, startsAt },
  });
  await logAdminAction(
    admin.id,
    `monitorProgram.update:enabled=${enabled},capacity=${capacity},freeMonths=${freeMonths}`
  );
  revalidatePath("/admin/monitor");
}
