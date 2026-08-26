"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hash } from "@/lib/password";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { sendVerificationEmail } from "@/lib/verification";

export type RegisterState = { error?: string } | undefined;

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const representativeName = String(formData.get("representativeName") ?? "").trim();
  const userName = String(formData.get("userName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const agreed = formData.get("agreed") === "on";

  if (!companyName || !userName || !email || !password) {
    return { error: "必須項目が未入力です。" };
  }
  if (password.length < 8) {
    return { error: "パスワードは8文字以上で設定してください。" };
  }
  if (!agreed) {
    return { error: "利用規約・プライバシーポリシーへの同意が必要です。" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "このメールアドレスは既に登録されています。" };
  }

  const passwordHash = await hash(password);

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        representativeName: representativeName || null,
      },
    });
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email,
        passwordHash,
        name: userName,
        role: "ADMIN",
      },
    });
    return { company, user };
  });

  await logAction({
    companyId: company.id,
    userId: user.id,
    action: "auth.register",
    targetType: "Company",
    targetId: company.id,
  });

  // メール送信に失敗しても登録自体は成立させる(未認証のままログインはでき、
  // 画面上で再送を案内する。SECURITY.mdの「外部への操作は失敗時も利用者を詰まらせない」方針)。
  try {
    await sendVerificationEmail(user.id, user.email);
  } catch (err) {
    console.error("[register] failed to send verification email", err);
  }

  await createSession(user.id);
  redirect("/dashboard");
}
