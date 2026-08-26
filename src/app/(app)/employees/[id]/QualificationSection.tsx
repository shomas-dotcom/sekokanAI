"use client";

import { useActionState } from "react";
import { addQualificationAction, deleteQualificationAction } from "../actions";
import { Input, Button } from "@/components/ui";
import { isExpired, isExpiringSoon } from "@/lib/qualifications";

type Qualification = {
  id: string;
  name: string;
  expiresAt: Date | string | null;
  notes: string | null;
};

function formatDate(value: Date | string | null): string {
  if (!value) return "期限なし";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("ja-JP");
}

export function QualificationSection({
  employeeId,
  qualifications,
}: {
  employeeId: string;
  qualifications: Qualification[];
}) {
  const [state, formAction, pending] = useActionState(addQualificationAction, undefined);

  return (
    <div className="flex flex-col gap-3">
      {qualifications.length === 0 ? (
        <p className="text-sm text-slate-400">まだ資格が登録されていません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {qualifications.map((q) => {
            const expired = isExpired(typeof q.expiresAt === "string" ? new Date(q.expiresAt) : q.expiresAt);
            const soon = isExpiringSoon(typeof q.expiresAt === "string" ? new Date(q.expiresAt) : q.expiresAt);
            return (
              <li
                key={q.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-slate-900">{q.name}</span>
                  <span
                    className={
                      expired
                        ? "ml-2 text-rose-600"
                        : soon
                          ? "ml-2 text-amber-600"
                          : "ml-2 text-slate-500"
                    }
                  >
                    期限: {formatDate(q.expiresAt)}
                    {expired && "(期限切れ)"}
                    {soon && !expired && "(期限間近)"}
                  </span>
                </div>
                <form action={deleteQualificationAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <Button type="submit" variant="danger">
                    削除
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
        <input type="hidden" name="employeeId" value={employeeId} />
        <Input name="name" placeholder="資格名(例: 玉掛け技能講習)" required className="sm:col-span-2" />
        <Input type="date" name="expiresAt" />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "追加中..." : "資格を追加"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
    </div>
  );
}
