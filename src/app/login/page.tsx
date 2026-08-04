"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { Input, Button, Card } from "@/components/ui";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">
            現
          </span>
          <h1 className="text-2xl font-bold tracking-tight">現場AI</h1>
          <p className="text-sm text-white/70">建設業向けAI業務改善パッケージ</p>
        </div>

        <Card>
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

          <p className="mt-6 text-center text-sm text-slate-500">
            アカウントをお持ちでない方は{" "}
            <Link href="/register" className="font-medium text-indigo-600 underline">
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
