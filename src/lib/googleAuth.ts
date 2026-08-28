// Googleでログイン/新規登録。SDKは追加せず、Googleの公開エンドポイントを直接fetchする
// (Anthropic連携(@/lib/ai)と同じ方針。ARCHITECTURE.md参照)。
//
// 未設定時(GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET未設定)は「モック」で代用できる性質の
// 機能ではない(本物のGoogleアカウントとの連携そのものが目的のため)。未設定の間はボタン自体を
// 非表示にし、直接アクセスされた場合もエラーで弾く(isGoogleConfigured参照)。

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/google/callback`;
}

/** Googleの同意画面へのURLを組み立てる。stateはCSRF対策で呼び出し側がcookieと突き合わせる。 */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/**
 * 認可コードをアクセストークン/IDトークンと交換し、IDトークンをGoogleのtokeninfo
 * エンドポイントで検証・デコードする(署名検証つきJWTライブラリを追加せず、
 * Googleに直接確認してもらう方式。ARCHITECTUREの「依存を増やさない」方針に合わせる)。
 * 失敗した場合はnullを返す(呼び出し側でログインエラーとして扱う)。
 */
export async function exchangeGoogleCode(code: string): Promise<GoogleIdentity | null> {
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenBody = (await tokenRes.json()) as { id_token?: string };
    if (!tokenBody.id_token) return null;

    const infoRes = await fetch(
      `${GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(tokenBody.id_token)}`
    );
    if (!infoRes.ok) return null;
    const claims = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      aud?: string;
    };

    // tokeninfoは誰でも呼び出せるエンドポイントのため、audience(自分のclient_id宛か)を
    // 必ず確認する。確認しないと他アプリ向けに発行されたIDトークンでもなりすませてしまう。
    if (!claims.sub || !claims.email || claims.aud !== process.env.GOOGLE_CLIENT_ID) return null;

    return {
      googleId: claims.sub,
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: claims.name ?? null,
    };
  } catch (err) {
    console.error("[googleAuth] exchangeGoogleCode failed", err);
    return null;
  }
}
