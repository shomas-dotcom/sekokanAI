"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/password";
import { createPlatformAdminSession } from "@/lib/platformAdminSession";

export type AdminLoginState = { error?: string } | undefined;

export async function adminLoginAction(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  const ok = admin ? await verify(password, admin.passwordHash) : false;

  if (!admin || !ok) {
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  await createPlatformAdminSession(admin.id);
  redirect("/admin/dashboard");
}
