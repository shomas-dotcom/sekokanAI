"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hash } from "@/lib/password";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

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

  await createSession(user.id);
  redirect("/dashboard");
}
