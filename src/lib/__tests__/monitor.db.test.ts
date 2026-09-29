import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOrCreateMonitorProgram, tryEnrollMonitor } from "@/lib/monitor";

// モニター募集(30社限定・6か月無料)の枠確保が、同時登録でも枠数を超えないかを確認する
// 結合テスト。既存の枠数設定(本番相当の値)を壊さないよう、開始前に退避して終了後に戻す。
// このテストが作った会社(名前が「モニターテスト」で始まるもの)だけを終了後に削除する。
const TEST_COMPANY_PREFIX = "モニターテスト株式会社";

let originalProgram: Awaited<ReturnType<typeof getOrCreateMonitorProgram>>;

beforeAll(async () => {
  originalProgram = await getOrCreateMonitorProgram();
});

afterAll(async () => {
  await prisma.company.deleteMany({ where: { name: { startsWith: TEST_COMPANY_PREFIX } } });
  await prisma.monitorProgram.update({
    where: { id: "singleton" },
    data: {
      enabled: originalProgram.enabled,
      capacity: originalProgram.capacity,
      startsAt: originalProgram.startsAt,
      freeMonths: originalProgram.freeMonths,
    },
  });
});

async function enrollTestCompany(name: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tryEnrollMonitor(tx);
    if (!result.ok) return { ok: false as const, status: result.status };
    const company = await tx.company.create({
      data: {
        name,
        isMonitor: true,
        monitorEnrolledAt: result.enrolledAt,
        monitorFreeMonths: result.freeMonths,
      },
    });
    return { ok: true as const, company };
  });
}

describe("tryEnrollMonitor", () => {
  it("受付開始前はnot_startedで失敗し、会社を作らない", async () => {
    const usedBefore = await prisma.company.count({ where: { isMonitor: true } });
    await prisma.monitorProgram.update({
      where: { id: "singleton" },
      data: { enabled: true, capacity: usedBefore + 5, startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    const result = await enrollTestCompany(`${TEST_COMPANY_PREFIX}開始前`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status.status).toBe("not_started");
    const usedAfter = await prisma.company.count({ where: { isMonitor: true } });
    expect(usedAfter).toBe(usedBefore);
  });

  it("受付停止中(enabled=false)はdisabledで失敗する", async () => {
    await prisma.monitorProgram.update({
      where: { id: "singleton" },
      data: { enabled: false, startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const result = await enrollTestCompany(`${TEST_COMPANY_PREFIX}停止中`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status.status).toBe("disabled");
  });

  it("残り枠ぶんだけ同時登録が成功し、それ以上はfullになる(枠を超えない)", async () => {
    const usedBefore = await prisma.company.count({ where: { isMonitor: true } });
    const capacity = usedBefore + 3; // 残り枠を3にそろえる
    await prisma.monitorProgram.update({
      where: { id: "singleton" },
      data: { enabled: true, capacity, startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => enrollTestCompany(`${TEST_COMPANY_PREFIX}同時${i}`))
    );

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    expect(succeeded.length).toBe(3);
    expect(failed.length).toBe(3);
    for (const f of failed) {
      if (!f.ok) expect(f.status.status).toBe("full");
    }

    const usedAfter = await prisma.company.count({ where: { isMonitor: true } });
    expect(usedAfter).toBe(capacity);
  });
});
