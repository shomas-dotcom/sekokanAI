"use client";

import { useActionState } from "react";
import { linkEmployeeToUserAction, unlinkEmployeeFromUserAction } from "../actions";
import { Select, Button } from "@/components/ui";

type CandidateUser = { id: string; name: string; email: string };

/**
 * 従業員(Employee)とログイン利用者(User)の関連付け。勤怠機能で「ログインしている人が
 * 自分の勤怠だけを操作できる」ようにするための前提となる紐付けを、管理者がここで行う。
 */
export function EmployeeUserLinkSection({
  employeeId,
  linkedUser,
  candidates,
}: {
  employeeId: string;
  linkedUser: CandidateUser | null;
  candidates: CandidateUser[];
}) {
  const [state, formAction, pending] = useActionState(linkEmployeeToUserAction, undefined);

  if (linkedUser) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-slate-700">
          関連付け済みの利用者: <span className="font-medium text-slate-900">{linkedUser.name}</span>
          <span className="text-slate-400">({linkedUser.email})</span>
        </p>
        <form action={unlinkEmployeeFromUserAction} className="w-fit">
          <input type="hidden" name="userId" value={linkedUser.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <Button type="submit" variant="secondary">
            関連付けを解除する
          </Button>
        </form>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        関連付けられる利用者がいません(すでに他の従業員と関連付け済みか、利用者が登録されていません)。
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        ログイン利用者
        <Select name="userId" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}({u.email})
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        関連付ける
      </Button>
      {state?.error && <p className="w-full text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}
