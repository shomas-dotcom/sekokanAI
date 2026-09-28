import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  AiLimitReachedError,
  RESERVATION_TTL_MINUTES,
  isOverLimit,
  jstMonthStart,
  parseLimit,
  resolveCompanyLimit,
} from "@/lib/aiUsageLimit";

// AI(Anthropic API)呼び出し1回ごとの利用実績を記録する。company_id/user_id/機能名/
// 使用モデル/トークン数/成否/エラー内容を残し、将来の料金プラン設計・原価分析
// (「AIコスト管理」機能)や利用状況分析(継続率・利用率等)の元データにする。
//
// 重要: ログの記録自体が失敗しても、AI機能そのものは絶対に止めない
// (fire-and-forgetの記録であり、例外は必ずこの関数の中で握りつぶす)。
// ただし利用回数の上限(reserveAiRun)に達した場合だけは、費用を止めるため呼び出しを止める。

export type AiUsageContext = {
  companyId: string;
  userId: string;
  /** どの機能からの呼び出しか(例: "quote.draft", "dailyReport.draft", "businessCard.scan") */
  feature: string;
};

export type AiUsageResult = {
  /** 実際に呼んだモデル名。AI未設定(モック動作)の場合は "mock" を渡す */
  model: string;
  success: boolean;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorMessage?: string | null;
};

export async function recordAiUsage(
  context: AiUsageContext | undefined,
  result: AiUsageResult
): Promise<void> {
  // 呼び出し元がcompany_id/user_idを渡さない場合は記録しない(既存のユニットテスト等、
  // 会社・利用者の文脈が無い呼び出しを想定)。
  if (!context) return;
  try {
    await prisma.aiUsageLog.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        feature: context.feature,
        model: result.model,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        success: result.success,
        errorMessage: result.errorMessage ?? null,
      },
    });
  } catch (err) {
    console.error("[aiUsageLog] failed to record AI usage", err);
  }
}

/** 上限の計算に数える行(今月・mock以外・成功済み、または期限内の予約中)。 */
function countedRunsWhere(since: Date, now: Date): Prisma.AiUsageLogWhereInput {
  return {
    createdAt: { gte: since },
    model: { not: "mock" },
    OR: [
      { status: "DONE", success: true },
      { status: "RESERVED", createdAt: { gte: new Date(now.getTime() - RESERVATION_TTL_MINUTES * 60 * 1000) } },
    ],
  };
}

async function companyLimitOf(
  db: Pick<Prisma.TransactionClient, "company">,
  companyId: string
): Promise<number | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { pricingPlan: { select: { aiRunLimit: true } } },
  });
  return resolveCompanyLimit(company?.pricingPlan?.aiRunLimit, parseLimit(process.env.AI_MONTHLY_LIMIT_PER_COMPANY));
}

/** 今月の会社のAI利用回数と上限(画面表示用)。上限nullは無制限。 */
export async function getCompanyAiUsage(companyId: string): Promise<{ used: number; limit: number | null }> {
  const now = new Date();
  const [used, limit] = await Promise.all([
    prisma.aiUsageLog.count({ where: { companyId, ...countedRunsWhere(jstMonthStart(now), now) } }),
    companyLimitOf(prisma, companyId),
  ]);
  return { used, limit };
}

/**
 * AIを呼ぶ前に1回分を予約する。上限に達していれば AiLimitReachedError を投げる(AIは呼ばれない)。
 * 同時に押されても上限を超えないよう、会社ごと(と全体)の鍵をかけてから数える。
 * 戻り値の予約IDを finishAiRun に渡して結果を書く。contextが無い呼び出しは予約しない(null)。
 */
export async function reserveAiRun(context: AiUsageContext | undefined, model: string): Promise<string | null> {
  if (!context) return null;
  const now = new Date();
  const since = jstMonthStart(now);
  const totalLimit = parseLimit(process.env.AI_MONTHLY_LIMIT_TOTAL);

  return prisma.$transaction(async (tx) => {
    if (totalLimit != null) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('genba-ai:ai-usage:total'))`;
    }
    const companyKey = `genba-ai:ai-usage:${context.companyId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyKey}))`;

    const companyLimit = await companyLimitOf(tx, context.companyId);
    if (companyLimit != null) {
      const used = await tx.aiUsageLog.count({
        where: { companyId: context.companyId, ...countedRunsWhere(since, now) },
      });
      if (isOverLimit(used, companyLimit)) throw new AiLimitReachedError("company");
    }
    if (totalLimit != null) {
      const usedTotal = await tx.aiUsageLog.count({ where: countedRunsWhere(since, now) });
      if (isOverLimit(usedTotal, totalLimit)) throw new AiLimitReachedError("total");
    }

    const reserved = await tx.aiUsageLog.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        feature: context.feature,
        model,
        success: false,
        status: "RESERVED",
      },
    });
    return reserved.id;
  });
}

/** 予約した1回分に結果を書いて完了にする。予約がない(context無し)場合は従来どおり記録する。 */
export async function finishAiRun(
  reservationId: string | null,
  context: AiUsageContext | undefined,
  result: AiUsageResult
): Promise<void> {
  if (!reservationId) return recordAiUsage(context, result);
  try {
    await prisma.aiUsageLog.update({
      where: { id: reservationId },
      data: {
        model: result.model,
        success: result.success,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        errorMessage: result.errorMessage ?? null,
        status: "DONE",
      },
    });
  } catch (err) {
    console.error("[aiUsageLog] failed to finish AI usage reservation", err);
  }
}
