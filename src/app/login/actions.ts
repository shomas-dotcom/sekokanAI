"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/password";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

export type LoginState = { error?: string } | undefined;

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

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verify(password, user.passwordHash) : false;

  if (!user || !ok) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  await createSession(user.id);
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "auth.login",
  });
  redirect("/dashboard");
}
