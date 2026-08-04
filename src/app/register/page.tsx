"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold">会社登録(無料)</h1>
        <p className="mt-1 text-sm text-zinc-500">
          会社情報と管理者アカウントを作成します。
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <Field label="会社名" name="companyName" required />
          <Field label="代表者名" name="representativeName" />
          <Field label="担当者氏名" name="userName" required />
          <Field label="メールアドレス" name="email" type="email" required />
          <Field
            label="パスワード(8文字以上)"
            name="password"
            type="password"
            required
            minLength={8}
          />

          <label className="flex items-start gap-2 text-sm text-zinc-600">
            <input type="checkbox" name="agreed" className="mt-1" />
            <span>利用規約・プライバシーポリシーに同意します。</span>
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
            {pending ? "登録中..." : "登録する"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          既にアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
      {label}
      {required && <span className="text-red-500"> *</span>}
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-base font-normal text-zinc-900 focus:border-zinc-500 focus:outline-none"
      />
    </label>
  );
}
