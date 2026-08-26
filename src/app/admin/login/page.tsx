"use client";

import { useActionState } from "react";
import { adminLoginAction } from "./actions";
import { Input, Button, Card } from "@/components/ui";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLoginAction, undefined);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <h1 className="text-xl font-bold tracking-tight">現場AI 運営管理</h1>
          <p className="mt-1 text-sm text-slate-400">サービス運営者専用ログイン</p>
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
        </Card>
      </div>
    </div>
  );
}
