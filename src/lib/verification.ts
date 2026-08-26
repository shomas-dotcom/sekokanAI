import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export type VerificationPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TOKEN_HOURS: Record<VerificationPurpose, number> = {
  EMAIL_VERIFY: 24,
  PASSWORD_RESET: 1,
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** トークンを発行してDBに保存する。生トークンはメール本文にのみ使い、戻り値以外には残さない。 */
async function issueToken(userId: string, purpose: VerificationPurpose): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_HOURS[purpose] * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { userId, tokenHash: hashToken(token), purpose, expiresAt },
  });

  return token;
}

/**
 * トークンを検証し、有効であれば使用済みにしてuserIdを返す。
 * 無効・期限切れ・使用済みの場合はnullを返す(理由を外部に漏らさない)。
 */
export async function consumeToken(
  rawToken: string,
  purpose: VerificationPurpose
): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.userId;
}

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await issueToken(userId, "EMAIL_VERIFY");
  const url = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;
  await sendEmail({
    to: email,
    subject: "【現場AI】メールアドレスの確認",
    text: `以下のリンクをクリックして、メールアドレスの確認を完了してください(24時間有効)。\n\n${url}\n\n心当たりがない場合は、このメールは無視してください。`,
  });
}

export async function sendPasswordResetEmail(userId: string, email: string): Promise<void> {
  const token = await issueToken(userId, "PASSWORD_RESET");
  const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  await sendEmail({
    to: email,
    subject: "【現場AI】パスワード再設定",
    text: `以下のリンクからパスワードを再設定してください(1時間有効)。\n\n${url}\n\n心当たりがない場合は、このメールは無視してください。パスワードは変更されません。`,
  });
}
