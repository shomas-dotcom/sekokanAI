"use client";

import { useActionState } from "react";
import { inviteTeamMemberAction, updateTeamMemberRoleAction, removeTeamMemberAction } from "./actions";
import { Input, Select, Button, FieldLabel } from "@/components/ui";

const ROLE_LABEL: Record<string, string> = { ADMIN: "管理者", MEMBER: "使用者" };

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: Date | null;
};

/**
 * 同じ会社のメンバー(利用者)を招待・権限変更・削除する画面。追加したメンバーは
 * 自動的に同じ会社のデータ(日報等)を共有する(companyIdによる絞り込みは
 * 既存のテナント分離の仕組みそのままで、この画面で新たに何かを変えるわけではない)。
 */
export function TeamSection({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const [state, formAction, pending] = useActionState(inviteTeamMemberAction, undefined);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-slate-900">
                {m.name} {m.id === currentUserId && <span className="text-xs text-slate-400">(自分)</span>}
              </p>
              <p className="text-xs text-slate-500">{m.email}</p>
              {m.lastLoginAt && (
                <p className="text-xs text-slate-400">
                  最終ログイン: {m.lastLoginAt.toLocaleString("ja-JP")}
                </p>
              )}
            </div>
            {m.id === currentUserId ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <form action={updateTeamMemberRoleAction} className="flex items-center gap-1">
                  <input type="hidden" name="id" value={m.id} />
                  <select
                    name="role"
                    defaultValue={m.role}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="ADMIN">管理者</option>
                    <option value="MEMBER">使用者</option>
                  </select>
                </form>
                <form action={removeTeamMemberAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>

      <form action={formAction} className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
        <FieldLabel label="氏名">
          <Input name="name" required className="w-40" />
        </FieldLabel>
        <FieldLabel label="メールアドレス">
          <Input name="email" type="email" required className="w-56" />
        </FieldLabel>
        <FieldLabel label="権限">
          <Select name="role" defaultValue="MEMBER" className="w-28">
            <option value="MEMBER">使用者</option>
            <option value="ADMIN">管理者</option>
          </Select>
        </FieldLabel>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "招待中..." : "+ メンバーを招待"}
        </Button>
      </form>
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.success}</p>
      )}
    </div>
  );
}
