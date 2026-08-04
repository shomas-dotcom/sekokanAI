"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold">現場AI ログイン</h1>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            メールアドレス
            <input
              name="email"
              type="email"
              required
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            パスワード
            <input
              name="password"
              type="password"
              required
              className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
            />
          </label>

          {state?.error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="font-medium text-zinc-900 underline">
            会社登録
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-zinc-400">
          デモ: demo@genba-ai.local / demo-password-change-me
        </p>
      </div>
    </div>
  );
}
