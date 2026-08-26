import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RateMasterItemForm } from "../RateMasterItemForm";
import { updateRateMasterItemAction, deleteRateMasterItemAction } from "../actions";
import { Card, Button } from "@/components/ui";

export default async function RateMasterItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const item = await prisma.rateMasterItem.findFirst({ where: { id, companyId: user.companyId } });
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{item.name}</h1>
      <Card className="max-w-lg">
        <RateMasterItemForm action={updateRateMasterItemAction} item={item} submitLabel="更新する" />
      </Card>
      <form action={deleteRateMasterItemAction} className="max-w-lg">
        <input type="hidden" name="id" value={item.id} />
        <Button type="submit" variant="danger">
          この単価を削除する
        </Button>
      </form>
    </div>
  );
}
