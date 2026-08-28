import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";
import { updateCompanyAction } from "./actions";
import { TeamSection } from "./team/TeamSection";

const TEAM_ERROR_MESSAGE: Record<string, string> = {
  self: "自分自身の権限変更・削除は、この画面からはできません。",
  last_admin: "会社に管理者が1人もいなくなるため、この操作はできません。",
  not_found: "対象のメンバーが見つかりません。",
  invalid_role: "不正な権限区分です。",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ teamError?: string }>;
}) {
  const { teamError } = await searchParams;
  const user = await requireAdmin();
  const [company, members] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: user.companyId } }),
    prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">会社設定</h1>
        <p className="mt-1 text-sm text-slate-500">
          見積書・契約書・請求書に表示される自社情報です。管理者のみ編集できます。
        </p>
      </div>
      <Card>
        <SettingsForm action={updateCompanyAction} company={company} />
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">利用者(チームメンバー)</h2>
        <p className="mt-1 text-sm text-slate-500">
          同じ会社の利用者を追加すると、日報・見積・請求書などのデータを全員で共有できます。
        </p>
        {teamError && TEAM_ERROR_MESSAGE[teamError] && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {TEAM_ERROR_MESSAGE[teamError]}
          </p>
        )}
        <div className="mt-3">
          <TeamSection members={members} currentUserId={user.id} />
        </div>
      </Card>
    </div>
  );
}
