"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { resetPasswordAction } from "./actions";
import { Input, Button, Card } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-amber-600 via-orange-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card>
          <form action={formAction} className="flex flex-col gap-4">
            <h1 className="text-lg font-bold text-slate-900">新しいパスワードを設定</h1>
            <input type="hidden" name="token" value={token} />
            {!token && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                リンクが正しくありません。パスワード再設定を最初からやり直してください。
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              新しいパスワード(8文字以上)
              <Input name="password" type="password" required minLength={8} />
            </label>
            {state?.error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
            )}
            <Button type="submit" disabled={pending || !token} className="mt-1 w-full">
              {pending ? "更新中..." : "パスワードを更新する"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
