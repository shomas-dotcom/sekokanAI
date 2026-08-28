import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../CustomerForm";
import { updateCustomerAction, deleteCustomerAction } from "../actions";
import { Card, Button } from "@/components/ui";
import { Tabs } from "@/components/Tabs";
import { EntityFileSection } from "@/components/entityFiles/EntityFileSection";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [customer, files] = await Promise.all([
    prisma.customer.findFirst({ where: { id, companyId: user.companyId } }),
    prisma.entityFile.findMany({
      where: { entityType: "CUSTOMER", entityId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{customer.name}</h1>
      <Tabs
        tabs={[
          {
            label: "基本情報",
            content: (
              <div className="flex max-w-lg flex-col gap-4">
                <Card>
                  <CustomerForm action={updateCustomerAction} customer={customer} submitLabel="更新する" />
                </Card>
                <form action={deleteCustomerAction}>
                  <input type="hidden" name="id" value={customer.id} />
                  <Button type="submit" variant="danger">
                    この顧客を削除する
                  </Button>
                </form>
              </div>
            ),
          },
          {
            label: "ファイル参照",
            content: (
              <div className="max-w-lg">
                <EntityFileSection entityType="CUSTOMER" entityId={customer.id} files={files} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
