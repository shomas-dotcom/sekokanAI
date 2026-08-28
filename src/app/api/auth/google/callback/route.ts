import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { exchangeGoogleCode, isGoogleConfigured } from "@/lib/googleAuth";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

const STATE_COOKIE = "google_oauth_state";

function fail(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) return fail(request, "google_not_configured");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(request, "google_failed");
  }

  const identity = await exchangeGoogleCode(code);
  if (!identity) return fail(request, "google_failed");
  // Googleが確認していないメールアドレスは信用しない
  // (他人のメールを名乗って既存アカウントに連携される事故を防ぐ)。
  if (!identity.emailVerified) return fail(request, "google_email_unverified");

  let user = await prisma.user.findUnique({
    where: { googleId: identity.googleId },
    include: { company: true },
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: identity.email }, include: { company: true } });
    if (byEmail) {
      // 既存のメール/パスワードアカウントに、確認済みメールが一致した場合のみGoogleを連携する
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: identity.googleId },
        include: { company: true },
      });
    }
  }

  let isNewSignup = false;
  if (!user) {
    isNewSignup = true;
    const { company, user: created } = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: `${identity.name ?? identity.email}の会社` },
      });
      const created = await tx.user.create({
        data: {
          companyId: company.id,
          email: identity.email,
          passwordHash: null,
          googleId: identity.googleId,
          name: identity.name ?? identity.email,
          role: "ADMIN",
          emailVerifiedAt: new Date(), // Googleが確認済みのメールのため、自前の確認メールは不要
        },
      });
      return { company, user: created };
    });
    user = { ...created, company };
    await logAction({
      companyId: company.id,
      userId: created.id,
      action: "auth.register.google",
      targetType: "Company",
      targetId: company.id,
    });
  }

  if (user.deletedAt) return fail(request, "google_failed");
  if (user.company.isSuspended) return fail(request, "google_failed");

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession(user.id);
  if (!isNewSignup) {
    await logAction({ companyId: user.companyId, userId: user.id, action: "auth.login.google" });
  }

  return NextResponse.redirect(new URL(isNewSignup ? "/onboarding" : "/dashboard", request.url));
}
