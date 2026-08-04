import { requireUser } from "@/lib/auth";

/** 会社がプレミアムプランかどうかを返す。requireUser()が返すuser.company.planを利用する。 */
export function isPremium(company: { plan: string }): boolean {
  return company.plan === "PREMIUM";
}

/**
 * プレミアム限定機能の入口で呼び出す。未加入の場合はnullを返すので、
 * 呼び出し側でアップセル画面を表示すること(redirectはしない — 案内文を出すため)。
 */
export async function requireUserWithPremium() {
  const user = await requireUser();
  if (!isPremium(user.company)) return null;
  return user;
}
