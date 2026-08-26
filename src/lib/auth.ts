import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/session";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // セッション発行後に退会・会社の利用停止が行われた場合、次のアクセスで即座に遮断する。
  if (user.deletedAt) {
    await destroySession();
    redirect("/login");
  }
  if (user.company.isSuspended) {
    await destroySession();
    redirect("/suspended");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
