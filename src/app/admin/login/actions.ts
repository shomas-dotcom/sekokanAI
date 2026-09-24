"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/password";
import { createPlatformAdminSession } from "@/lib/platformAdminSession";
import { adminLoginThrottle } from "@/lib/loginThrottle";

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

  // 総当たり攻撃対策: 連続失敗が上限に達したメールアドレスは、しばらくパスワード検証自体を行わない。
  // 存在しないメールアドレスも同じく数える(登録の有無で挙動を変えないため)。
  if (adminLoginThrottle.isLocked(email)) {
    return { error: "ログイン試行回数が上限に達しました。しばらく時間をおいて再度お試しください。" };
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  const ok = admin ? await verify(password, admin.passwordHash) : false;

  if (!admin || !ok) {
    adminLoginThrottle.recordFailure(email);
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  adminLoginThrottle.recordSuccess(email);
  await createPlatformAdminSession(admin.id);
  redirect("/admin/dashboard");
}
