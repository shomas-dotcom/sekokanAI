"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "./actions";
import { Input, Button, Card } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-amber-600 via-orange-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          {state?.sent ? (
            <p className="text-sm text-slate-700">
              入力されたメールアドレス宛に、パスワード再設定用のリンクを送信しました(該当するアカウントがある場合のみ届きます)。メールが届かない場合は、迷惑メールフォルダもご確認ください。
            </p>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <h1 className="text-lg font-bold text-slate-900">パスワードをお忘れの方</h1>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                メールアドレス
                <Input name="email" type="email" required />
              </label>
              {state?.error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
              )}
              <Button type="submit" disabled={pending} className="mt-1 w-full">
                {pending ? "送信中..." : "再設定メールを送る"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-orange-700 underline">
              ログインへ戻る
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
