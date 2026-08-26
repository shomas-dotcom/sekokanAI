import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";
import { updateCompanyAction } from "./actions";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const company = await prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });

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
    </div>
  );
}
