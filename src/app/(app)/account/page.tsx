import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { WithdrawForm } from "./WithdrawForm";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">アカウント</h1>
        <p className="mt-1 text-sm text-slate-500">ご自身のログイン情報の確認・退会はこちらから行えます。</p>
      </div>

      <Card>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">氏名</dt>
            <dd className="font-medium text-slate-900">{user.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">メールアドレス</dt>
            <dd className="font-medium text-slate-900">
              {user.email}{" "}
              {user.emailVerifiedAt ? (
                <span className="text-xs font-normal text-emerald-600">確認済み</span>
              ) : (
                <span className="text-xs font-normal text-amber-600">未確認</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">所属会社</dt>
            <dd className="font-medium text-slate-900">{user.company.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">権限</dt>
            <dd className="font-medium text-slate-900">{user.role === "ADMIN" ? "管理者" : "一般社員"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border-rose-200">
        <h2 className="text-sm font-semibold text-rose-700">退会</h2>
        <p className="mt-1 text-sm text-slate-600">
          退会すると、このアカウントではログインできなくなります。会社全体のデータや他のメンバーには影響しません。会社ごとデータを完全に削除したい場合は運営までお問い合わせください。
        </p>
        <WithdrawForm />
      </Card>
    </div>
  );
}
