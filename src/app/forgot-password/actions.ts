"use server";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/verification";

export type ForgotPasswordState = { sent: boolean; error?: string } | undefined;

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { sent: false, error: "メールアドレスを入力してください。" };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // 登録の有無を外部に漏らさないため、存在しなくても「送信しました」と同じ表示にする。
  if (user && !user.deletedAt) {
    try {
      await sendPasswordResetEmail(user.id, user.email);
    } catch (err) {
      console.error("[forgot-password] failed to send email", err);
    }
  }

  return { sent: true };
}
