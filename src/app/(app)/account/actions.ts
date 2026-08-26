"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { destroySession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { verify } from "@/lib/password";

export type WithdrawState = { error?: string } | undefined;

/**
 * 自分自身のアカウントの退会(論理削除)。会社そのもの・他のメンバーのデータは削除しない。
 * 誤操作防止のため、現在のパスワード入力を必須にする。
 */
export async function withdrawAction(
  _prevState: WithdrawState,
  formData: FormData
): Promise<WithdrawState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");

  const ok = await verify(password, user.passwordHash);
  if (!ok) {
    return { error: "パスワードが正しくありません。" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  await logAction({ companyId: user.companyId, userId: user.id, action: "auth.withdraw" });

  await destroySession();
  redirect("/login");
}
