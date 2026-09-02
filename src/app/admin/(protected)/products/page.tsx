import { prisma } from "@/lib/prisma";
import { Card, Input, Textarea, Select, Button, Label, Badge } from "@/components/ui";
import { createProductAction, updateProductAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "準備中",
  ON_SALE: "販売中",
  DISCONTINUED: "販売終了",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ON_SALE: "bg-emerald-100 text-emerald-700",
  DISCONTINUED: "bg-rose-100 text-rose-700",
};

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">商品管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          現場AI内で使っている便利な機能を「商品」として登録します。導入会社数・売上・原価・利益は、実際にどの会社がどの商品を使っているかを結びつける仕組みができてから表示します(今は数字を作らず空欄にしています)。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <Card key={product.id}>
            <form action={updateProductAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={product.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{product.name}</span>
                <Badge className={STATUS_BADGE[product.salesStatus]}>{STATUS_LABEL[product.salesStatus]}</Badge>
              </div>
              <Label>
                商品名
                <Input name="name" defaultValue={product.name} required />
              </Label>
              <Label>
                説明
                <Textarea name="description" rows={2} defaultValue={product.description ?? ""} />
              </Label>
              <Label>
                対象顧客
                <Input name="targetCustomer" defaultValue={product.targetCustomer ?? ""} />
              </Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Label>
                  買い切り価格(円)
                  <Input name="price" type="number" min={0} defaultValue={product.price ?? ""} />
                </Label>
                <Label>
                  月額価格(円)
                  <Input name="monthlyPrice" type="number" min={0} defaultValue={product.monthlyPrice ?? ""} />
                </Label>
                <Label>
                  初期費用(円)
                  <Input name="setupFee" type="number" min={0} defaultValue={product.setupFee ?? ""} />
                </Label>
              </div>
              <Label>
                機能・できること(箇条書き)
                <Textarea name="featuresText" rows={3} defaultValue={product.featuresText ?? ""} />
              </Label>
              <Label>
                販売状態
                <Select name="salesStatus" defaultValue={product.salesStatus}>
                  <option value="DRAFT">準備中</option>
                  <option value="ON_SALE">販売中</option>
                  <option value="DISCONTINUED">販売終了</option>
                </Select>
              </Label>
              <Button type="submit" className="w-fit">
                保存
              </Button>
            </form>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">新しい商品を追加</h2>
        <form action={createProductAction} className="flex flex-col gap-3">
          <Label>
            商品名
            <Input name="name" placeholder="例: AI写真帳作成" required />
          </Label>
          <Label>
            説明
            <Textarea name="description" rows={2} />
          </Label>
          <Label>
            対象顧客
            <Input name="targetCustomer" placeholder="例: 従業員10名以下の土木会社" />
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Label>
              買い切り価格(円)
              <Input name="price" type="number" min={0} />
            </Label>
            <Label>
              月額価格(円)
              <Input name="monthlyPrice" type="number" min={0} />
            </Label>
            <Label>
              初期費用(円)
              <Input name="setupFee" type="number" min={0} />
            </Label>
          </div>
          <Label>
            機能・できること(箇条書き)
            <Textarea name="featuresText" rows={3} />
          </Label>
          <Label>
            販売状態
            <Select name="salesStatus" defaultValue="DRAFT">
              <option value="DRAFT">準備中</option>
              <option value="ON_SALE">販売中</option>
              <option value="DISCONTINUED">販売終了</option>
            </Select>
          </Label>
          <Button type="submit" variant="secondary" className="w-fit">
            追加する
          </Button>
        </form>
      </Card>
    </div>
  );
}
