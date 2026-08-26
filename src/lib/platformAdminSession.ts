import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

// テナント側(genba_session)とは別名のCookieを使う。同じ名前にすると、片方の
// ログアウトがもう片方に影響する等の混乱の原因になるため明確に分ける。
const COOKIE_NAME = "genba_admin_session";
const SESSION_DAYS = 7; // 運営者セッションはテナントより短くする

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPlatformAdminSession(adminId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.platformAdminSession.create({
    data: { tokenHash: hashToken(token), adminId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyPlatformAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.platformAdminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionPlatformAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.platformAdminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.platformAdminSession.delete({ where: { id: session.id } });
    return null;
  }

  return session.admin;
}
