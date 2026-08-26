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
 * NumberSequenceの更新をトランザクション内で行うことで、同時に複数リクエストが
 * 来ても同じ番号が二重発行されないようにする(REQUIREMENTS.md #18)。
 * SQLiteは書き込みを直列化するため単一プロセスでは重複しないが、
 * 複数プロセス/Postgres移行後はトランザクション分離レベルの確認が必要。
 */
export async function nextDocumentNumber(
  companyId: string,
  docType: DocumentNumberType,
  at: Date = new Date()
): Promise<string> {
  const year = at.getFullYear();

  const sequence = await prisma.$transaction(async (tx) => {
    const existing = await tx.numberSequence.findUnique({
      where: { companyId_docType_year: { companyId, docType, year } },
    });
    if (existing) {
      return tx.numberSequence.update({
        where: { id: existing.id },
        data: { lastNumber: existing.lastNumber + 1 },
      });
    }
    return tx.numberSequence.create({
      data: { companyId, docType, year, lastNumber: 1 },
    });
  });

  return `${PREFIX[docType]}-${year}-${String(sequence.lastNumber).padStart(4, "0")}`;
}
