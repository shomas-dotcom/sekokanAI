"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * 送信中は押せなくなる送信ボタン。サーバー側の処理(action={...})を使うフォームの中に置く。
 * 電波の弱い現場での連打・二度押しで同じ内容が2回登録されるのを防ぐ(調査報告F07)。
 */
export function PendingSubmitButton({
  children,
  pendingLabel = "送信中…",
  variant,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Parameters<typeof Button>[0]["variant"];
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
