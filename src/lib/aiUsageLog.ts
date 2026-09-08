import { prisma } from "@/lib/prisma";

// AI(Anthropic API)呼び出し1回ごとの利用実績を記録する。company_id/user_id/機能名/
// 使用モデル/トークン数/成否/エラー内容を残し、将来の料金プラン設計・原価分析
// (「AIコスト管理」機能)や利用状況分析(継続率・利用率等)の元データにする。
//
// 重要: ログの記録自体が失敗しても、AI機能そのものは絶対に止めない
// (fire-and-forgetの記録であり、例外は必ずこの関数の中で握りつぶす)。

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
