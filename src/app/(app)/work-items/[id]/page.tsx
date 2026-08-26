import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkItemForm } from "../WorkItemForm";
import { updateWorkItemAction, deleteWorkItemAction } from "../actions";
import { Card, Button } from "@/components/ui";

export default async function EditWorkItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const workItem = await prisma.workItemMaster.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!workItem) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{workItem.label}</h1>
      <Card className="max-w-lg">
        <WorkItemForm action={updateWorkItemAction} workItem={workItem} submitLabel="更新する" />
      </Card>
      <form action={deleteWorkItemAction} className="max-w-lg">
        <input type="hidden" name="id" value={workItem.id} />
        <Button type="submit" variant="danger">
          この作業内容を削除する
        </Button>
      </form>
    </div>
  );
}
