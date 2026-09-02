import { prisma } from "@/lib/prisma";
import { Card, Input, Textarea, Button, Label } from "@/components/ui";
import { createPlanAction, updatePlanAction } from "./actions";

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { companies: true } } },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">料金プラン管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          金額はここで変更できます。既存の契約会社には自動反映されません(会社ごとに「会社詳細」画面から割り当てます)。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <form action={updatePlanAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={plan.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-400">key: {plan.key}</span>
                <span className="text-xs text-slate-500">契約中の会社数: {plan._count.companies}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Label>
                  プラン名
                  <Input name="name" defaultValue={plan.name} required />
                </Label>
                <Label>
                  月額(円・税抜)
                  <Input name="monthlyPrice" type="number" min={0} defaultValue={plan.monthlyPrice} required />
                </Label>
                <Label>
                  初期費用(円・税抜)
                  <Input name="setupFee" type="number" min={0} defaultValue={plan.setupFee} required />
                </Label>
              </div>
              <Label>
                説明(任意)
                <Textarea name="description" rows={2} defaultValue={plan.description ?? ""} />
              </Label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="isActive" defaultChecked={plan.isActive} />
                新規契約の選択肢に表示する
              </label>
              <Button type="submit" className="w-fit">
                保存
              </Button>
            </form>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">新しいプランを追加</h2>
        <form action={createPlanAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Label>
              key(半角英数字、後から変更不可)
              <Input name="key" placeholder="例: enterprise" required />
            </Label>
            <Label>
              プラン名
              <Input name="name" placeholder="例: エンタープライズ" required />
            </Label>
            <Label>
              月額(円・税抜)
              <Input name="monthlyPrice" type="number" min={0} defaultValue={0} required />
            </Label>
            <Label>
              初期費用(円・税抜)
              <Input name="setupFee" type="number" min={0} defaultValue={0} required />
            </Label>
          </div>
          <Label>
            説明(任意)
            <Textarea name="description" rows={2} />
          </Label>
          <Button type="submit" variant="secondary" className="w-fit">
            追加する
          </Button>
        </form>
      </Card>
    </div>
  );
}
