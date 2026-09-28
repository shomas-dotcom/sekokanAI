// AIの月間利用回数の上限(調査報告F13)。上限の「値」は料金の決め事なのでコードに書かない。
// 次の順で決める(どれも未設定なら無制限=従来どおり):
//   1. 会社の料金プラン(Plan.aiRunLimit)
//   2. 環境変数 AI_MONTHLY_LIMIT_PER_COMPANY(プラン未設定の会社=モニター等の既定値)
//   3. 環境変数 AI_MONTHLY_LIMIT_TOTAL(全社合計の安全装置。AI費用の青天井を防ぐ)
// 数えるのは「実際にAIサービスを呼んで成功した回数」と「今呼んでいる最中(予約)の回数」。
// 失敗した呼び出し・AI未設定時の簡易判定(mock)は数えない(費用が発生しないため)。

/** 予約のまま完了しなかった行(サーバー停止等)を、いつまで数えるか。これより古い予約は無視する。 */
export const RESERVATION_TTL_MINUTES = 10;

export class AiLimitReachedError extends Error {
  constructor(public readonly scope: "company" | "total") {
    super(
      scope === "company"
        ? "今月のAI利用回数の上限に達しました。来月になるか、管理者にご相談ください。"
        : "AI機能が混み合っているため、一時的に利用を止めています。しばらくしてからお試しください。"
    );
    this.name = "AiLimitReachedError";
  }
}

/** 数値の設定値を読む。空・0未満・数字以外は「未設定(無制限)」として扱う。 */
export function parseLimit(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

/** 会社に適用する上限。プランの値を優先し、なければ既定値(環境変数)。 */
export function resolveCompanyLimit(planLimit: number | null | undefined, defaultLimit: number | null): number | null {
  return parseLimit(planLimit) ?? defaultLimit;
}

/** 使用済み回数が上限に達していれば true(上限0は「使わせない」)。上限nullは無制限。 */
export function isOverLimit(used: number, limit: number | null): boolean {
  return limit != null && used >= limit;
}

/** 日本時間での「今月1日0時」をUTCのDateで返す(月ごとの回数の区切り)。 */
export function jstMonthStart(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1, -9, 0));
}
