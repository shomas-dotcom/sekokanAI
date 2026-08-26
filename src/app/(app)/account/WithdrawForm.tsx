"use client";

import { useActionState, useState } from "react";
import { withdrawAction } from "./actions";
import { Input, Button } from "@/components/ui";

export function WithdrawForm() {
  const [state, formAction, pending] = useActionState(withdrawAction, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="danger" className="mt-3" onClick={() => setConfirming(true)}>
        退会する
      </Button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        確認のため、現在のパスワードを入力してください
        <Input name="password" type="password" required />
      </label>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "処理中..." : "本当に退会する"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          やめる
        </Button>
      </div>
    </form>
  );
}
