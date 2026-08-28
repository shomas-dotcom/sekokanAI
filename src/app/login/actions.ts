"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/password";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

export type LoginState = { error?: string } | undefined;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });

  // 総当たり攻撃対策: 直近の失敗回数が上限に達している場合はパスワード検証自体を行わない
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "ログイン試行回数が上限に達しました。しばらく時間をおいて再度お試しください。" };
  }

  // passwordHashがnull(Googleログインのみで作られたアカウント)の場合は
  // パスワードでのログインを許可しない(誤って空文字と比較しないよう明示的に弾く)。
  const ok =
    user && !user.deletedAt && user.passwordHash ? await verify(password, user.passwordHash) : false;

  if (!user || user.deletedAt || !ok) {
    if (user && !user.deletedAt) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil:
            failedLoginAttempts >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
              : null,
        },
      });
    }
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  if (user.company.isSuspended) {
    return { error: "このアカウントは現在利用停止中です。お問い合わせください。" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id);
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "auth.login",
  });
  redirect("/dashboard");
}
