"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";
import { Input, Button, Card } from "@/components/ui";

const GOOGLE_ERROR_MESSAGE: Record<string, string> = {
  google_failed: "Googleログインに失敗しました。もう一度お試しください。",
  google_email_unverified: "Googleで確認済みのメールアドレスが必要です。",
  google_not_configured: "現在Googleログインはご利用いただけません。",
};

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const searchParams = useSearchParams();
  const resetDone = searchParams.get("resetDone") === "1";
  const googleError = searchParams.get("error");

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-amber-600 via-orange-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">
            現
          </span>
          <h1 className="text-2xl font-bold tracking-tight">現場AI</h1>
          <p className="text-sm text-white/70">建設業向けAI業務改善パッケージ</p>
        </div>

        <Card>
          {resetDone && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              パスワードを更新しました。新しいパスワードでログインしてください。
            </p>
          )}
          {googleError && GOOGLE_ERROR_MESSAGE[googleError] && (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {GOOGLE_ERROR_MESSAGE[googleError]}
            </p>
          )}

          {googleEnabled && (
            <>
              <a
                href="/api/auth/google/start"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <GoogleIcon />
                Googleでログイン
              </a>
              <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                または
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              メールアドレス
              <Input name="email" type="email" required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              パスワード
              <Input name="password" type="password" required />
            </label>

            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
            )}

            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "ログイン中..." : "ログイン"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-orange-700 underline">
              パスワードをお忘れですか?
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="font-medium text-orange-700 underline">
              会社登録
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-400">
            デモ: demo@genba-ai.local / demo-password-change-me
          </p>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.6 35.4 27 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.5C41.4 35.5 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
