"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hash } from "@/lib/password";
import { consumeToken } from "@/lib/verification";
import { logAction } from "@/lib/audit";

export type ResetPasswordState = { error?: string } | undefined;

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "パスワードは8文字以上で設定してください。" };
  }

  const userId = await consumeToken(token, "PASSWORD_RESET");
  if (!userId) {
    return { error: "リンクの有効期限が切れているか、既に使用されています。もう一度お試しください。" };
  }

  const passwordHash = await hash(password);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  // パスワード変更時は、乗っ取られていた場合に備えて全端末のログインをやり直させる
  await prisma.session.deleteMany({ where: { userId } });

  await logAction({ companyId: user.companyId, userId: user.id, action: "auth.password_reset" });

  redirect("/login?resetDone=1");
}
