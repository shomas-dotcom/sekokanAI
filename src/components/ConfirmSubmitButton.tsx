"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * 押すと「本当に実行しますか」と確認してから、フォームを送るボタン。
 * 取り消せない操作(削除など)に使う。「キャンセル」を選べば、何も起きない。
 */
export function ConfirmSubmitButton({
  message,
  children,
  className,
  ...rest
}: { message: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...rest}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
