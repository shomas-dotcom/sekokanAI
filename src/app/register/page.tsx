"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";
import { Input, Button, Card, FieldLabel } from "@/components/ui";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur">
            現
          </span>
          <h1 className="text-2xl font-bold tracking-tight">会社登録(無料)</h1>
          <p className="text-sm text-white/70">会社情報と管理者アカウントを作成します</p>
        </div>

        <Card>
          <form action={formAction} className="flex flex-col gap-4">
            <FieldLabel label="会社名" required>
              <Input name="companyName" required />
            </FieldLabel>
            <FieldLabel label="代表者名">
              <Input name="representativeName" />
            </FieldLabel>
            <FieldLabel label="担当者氏名" required>
              <Input name="userName" required />
            </FieldLabel>
            <FieldLabel label="メールアドレス" required>
              <Input name="email" type="email" required />
            </FieldLabel>
            <FieldLabel label="パスワード(8文字以上)" required>
              <Input name="password" type="password" required minLength={8} />
            </FieldLabel>

            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="agreed" className="mt-1 accent-indigo-600" />
              <span>利用規約・プライバシーポリシーに同意します。</span>
            </label>

            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
            )}

            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "登録中..." : "登録する"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            既にアカウントをお持ちの方は{" "}
            <Link href="/login" className="font-medium text-indigo-600 underline">
              ログイン
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
