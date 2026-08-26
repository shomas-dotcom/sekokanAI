"use client";

import { useActionState } from "react";
import { startSubscriptionAction, openBillingPortalAction } from "./actions";
import { Button } from "@/components/ui";

export function StartSubscriptionForm() {
  const [state, formAction, pending] = useActionState(startSubscriptionAction, undefined);

  return (
    <form action={formAction} className="mt-4">
      {state?.error && <p className="mb-2 text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "処理中..." : "14日間無料で始める"}
      </Button>
    </form>
  );
}

export function BillingPortalForm({ disabled }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(openBillingPortalAction, undefined);

  return (
    <form action={formAction} className="mt-4">
      {state?.error && <p className="mb-2 text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" variant="secondary" disabled={pending || disabled}>
        {pending ? "処理中..." : "支払い方法・解約を管理する"}
      </Button>
    </form>
  );
}
