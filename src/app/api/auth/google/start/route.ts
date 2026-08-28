import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isGoogleConfigured, buildGoogleAuthUrl } from "@/lib/googleAuth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 認可コードのやり取りは通常すぐ終わるため10分で十分
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
