// 会社ごとの利用者数・保存容量の上限(調査報告F13)。上限の「値」は料金の決め事なのでコードに書かない。
// 会社の料金プラン(Plan.userLimit / storageLimitMb)を優先し、なければ環境変数の既定値。
// どちらも未設定なら無制限(従来どおり)。上限に達しても、既存データの閲覧・編集は止めない
// (新しく増やす操作=招待・アップロードだけを止める)。

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { parseLimit, resolveCompanyLimit } from "@/lib/aiUsageLimit";

type Db = Pick<Prisma.TransactionClient, "company">;

async function planLimits(db: Db, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { pricingPlan: { select: { userLimit: true, storageLimitMb: true } } },
  });
  return company?.pricingPlan ?? null;
}

/** 会社の利用者数の上限(退会済みは数えない)。nullは無制限。 */
export async function companyUserLimit(db: Db, companyId: string): Promise<number | null> {
  const plan = await planLimits(db, companyId);
  return resolveCompanyLimit(plan?.userLimit, parseLimit(process.env.USER_LIMIT_PER_COMPANY));
}

/** 会社の保存容量の上限(バイト)。nullは無制限。 */
export async function companyStorageLimitBytes(db: Db, companyId: string): Promise<number | null> {
  const plan = await planLimits(db, companyId);
  const mb = resolveCompanyLimit(plan?.storageLimitMb, parseLimit(process.env.STORAGE_LIMIT_MB_PER_COMPANY));
  return mb == null ? null : mb * 1024 * 1024;
}

/**
 * 会社の保存容量の使用量(バイト)。写真・案件資料・添付ファイル・見積雛形のExcelを合計する。
 * ファイルはDBに直接保存しているため、DB上の実際の大きさ(octet_length)で数える。
 */
export async function companyStorageUsedBytes(
  db: Pick<Prisma.TransactionClient, "$queryRaw">,
  companyId: string
): Promise<number> {
  const rows = await db.$queryRaw<{ total: bigint | number | null }[]>`
    SELECT
      (SELECT COALESCE(SUM(octet_length("data")), 0) FROM "ProjectFile" WHERE "companyId" = ${companyId})
    + (SELECT COALESCE(SUM(octet_length("data")), 0) FROM "EntityFile" WHERE "companyId" = ${companyId})
    + (SELECT COALESCE(SUM(octet_length("data")), 0) FROM "DailyReportPhoto" WHERE "companyId" = ${companyId})
    + (SELECT COALESCE(SUM(octet_length(v."fileData")), 0)
         FROM "QuoteTemplateVersion" v JOIN "QuoteTemplate" t ON t."id" = v."templateId"
        WHERE t."companyId" = ${companyId})
    AS "total"`;
  return Number(rows[0]?.total ?? 0);
}

/** 容量の上限を超えるなら利用者向けの説明文を返す。超えないならnull。上限nullは無制限。 */
export function storageLimitMessage(usedBytes: number, incomingBytes: number, limitBytes: number | null): string | null {
  if (limitBytes == null || usedBytes + incomingBytes <= limitBytes) return null;
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
  return `保存容量の上限(${mb(limitBytes)}MB)を超えるため保存できません(使用中 ${mb(usedBytes)}MB、追加 ${mb(incomingBytes)}MB)。不要な写真・ファイルを削除するか、運営までご相談ください。`;
}

/**
 * ファイルを保存してよいか確かめる。上限を超えるなら説明文、問題なければnullを返す。
 * 上限が未設定の会社では使用量の集計もしない(余計な負荷をかけない)。
 * 注意: 同時に複数のアップロードが来ると、わずかに上限を超えることがある(容量は目安として扱う)。
 */
export async function checkStorageForUpload(companyId: string, incomingBytes: number): Promise<string | null> {
  const limit = await companyStorageLimitBytes(prisma, companyId);
  if (limit == null) return null;
  const used = await companyStorageUsedBytes(prisma, companyId);
  return storageLimitMessage(used, incomingBytes, limit);
}

/** 同じ会社の「上限を数えて増やす」処理が同時に走らないよう、保存単位の中で会社ごとの鍵をかける。 */
export async function lockCompany(tx: Prisma.TransactionClient, companyId: string, purpose: string) {
  const key = `genba-ai:${purpose}:${companyId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
