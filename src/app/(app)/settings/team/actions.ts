"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendTeamInviteEmail } from "@/lib/verification";

export type TeamFormState = { error?: string; success?: string } | undefined;

const ROLES = ["ADMIN", "MEMBER"] as const;
type Role = (typeof ROLES)[number];

/**
 * 同じ会社のメンバーを追加する。パスワードはこの場で決めず、招待メールの
 * リンクから本人に設定してもらう(既存のパスワード再設定の仕組みをそのまま流用する)。
 * 追加した時点でそのまま同じ会社のデータ(日報等)を全員が共有できる
 * (companyIdによる絞り込みは既存の仕組みのまま変更していない)。
 */
export async function inviteTeamMemberAction(
  _prevState: TeamFormState,
  formData: FormData
): Promise<TeamFormState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "MEMBER");
  const role: Role = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : "MEMBER";

  if (!name || !email) return { error: "氏名とメールアドレスを入力してください。" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "このメールアドレスは既に登録されています。" };

  const member = await prisma.user.create({
    data: {
      companyId: admin.companyId,
      email,
      passwordHash: null,
      name,
      role,
    },
  });

  try {
    await sendTeamInviteEmail(member.id, member.email, admin.company.name, admin.name);
  } catch (err) {
    console.error("[team] failed to send invite email", err);
    return {
      error:
        "アカウントは作成しましたが、招待メールの送信に失敗しました。お手数ですが本人にパスワード再設定(ログイン画面の「パスワードをお忘れですか?」)からログインしてもらってください。",
    };
  }

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "team.invite",
    targetType: "User",
    targetId: member.id,
  });

  revalidatePath("/settings");
  return { success: `${email} を招待しました。パスワード設定用のメールを送信しています。` };
}

// useActionStateを使わない素朴な<form action>のため、エラーはinviteのように戻り値で
// 返さずクエリパラメータ経由で伝える(/invoicesの操作ボタンと同じ方式)。
export async function updateTeamMemberRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const role: Role | null = (ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as Role) : null;
  if (!role) redirect("/settings?teamError=invalid_role");

  if (id === admin.id) {
    redirect("/settings?teamError=self");
  }

  const target = await prisma.user.findFirst({ where: { id, companyId: admin.companyId } });
  if (!target) redirect("/settings?teamError=not_found");

  if (target.role === "ADMIN" && role === "MEMBER") {
    const adminCount = await prisma.user.count({
      where: { companyId: admin.companyId, role: "ADMIN", deletedAt: null },
    });
    if (adminCount <= 1) {
      redirect("/settings?teamError=last_admin");
    }
  }

  await prisma.user.update({ where: { id }, data: { role } });
  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "team.updateRole",
    targetType: "User",
    targetId: id,
  });

  revalidatePath("/settings");
}

export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  if (id === admin.id) {
    redirect("/settings?teamError=self");
  }

  const target = await prisma.user.findFirst({ where: { id, companyId: admin.companyId } });
  if (!target) redirect("/settings?teamError=not_found");

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { companyId: admin.companyId, role: "ADMIN", deletedAt: null },
    });
    if (adminCount <= 1) {
      redirect("/settings?teamError=last_admin");
    }
  }

  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: id } });

  await logAction({
    companyId: admin.companyId,
    userId: admin.id,
    action: "team.remove",
    targetType: "User",
    targetId: id,
  });

  revalidatePath("/settings");
}
