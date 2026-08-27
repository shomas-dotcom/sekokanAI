import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const PREFIX = {
  PROJECT: "PJ",
  ESTIMATE: "EST",
  CONTRACT: "CON",
  INVOICE: "INV",
} as const;

export type DocumentNumberType = keyof typeof PREFIX;

/**
 * 会社×書類種別×年度で連番を発行する(例: PJ-2026-0001)。
 * 「読み取り→+1して更新」という2ステップ方式は、Postgresの標準的な分離レベルでは
 * 複数リクエストが同時に来た際に同じ番号を発行してしまう(2026-08-27、Postgres移行後の
 * 結合テストで実際に再現した)。Postgresの `INSERT ... ON CONFLICT DO UPDATE` は
 * 単一のSQL文で読み取り+更新が原子的に行われるため、これに置き換えて解決している。
 */
export async function nextDocumentNumber(
  companyId: string,
  docType: DocumentNumberType,
  at: Date = new Date()
): Promise<string> {
  const year = at.getFullYear();

  const rows = await prisma.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "NumberSequence" ("id", "companyId", "docType", "year", "lastNumber", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${companyId}, ${docType}, ${year}, 1, now(), now())
    ON CONFLICT ("companyId", "docType", "year")
    DO UPDATE SET "lastNumber" = "NumberSequence"."lastNumber" + 1, "updatedAt" = now()
    RETURNING "lastNumber"
  `;

  const lastNumber = rows[0].lastNumber;
  return `${PREFIX[docType]}-${year}-${String(lastNumber).padStart(4, "0")}`;
}
