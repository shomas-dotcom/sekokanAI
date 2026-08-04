import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../CustomerForm";
import { updateCustomerAction, deleteCustomerAction } from "../actions";
import { Card, Button } from "@/components/ui";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.name}</h1>
      <Card className="max-w-lg">
        <CustomerForm action={updateCustomerAction} customer={customer} submitLabel="更新する" />
      </Card>
      <form action={deleteCustomerAction} className="max-w-lg">
        <input type="hidden" name="id" value={customer.id} />
        <Button type="submit" variant="danger">
          この顧客を削除する
        </Button>
      </form>
    </div>
  );
}
