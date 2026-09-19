import { prisma } from "@/lib/prisma";

/**
 * 会社の勤務設定を取得する。まだ作られていない会社(初期値のまま)には、
 * ここで初期値(8:00始業/17:00終業/休憩120分/月末締め/承認必要)の行を作成する。
 * 既存会社への一括データ移行(バックフィル)をせず、初回アクセス時に必要な分だけ作る方針。
 */
export async function getOrCreateWorkSettings(companyId: string) {
  const existing = await prisma.companyWorkSettings.findUnique({ where: { companyId } });
  if (existing) return existing;
  return prisma.companyWorkSettings.create({ data: { companyId } });
}
