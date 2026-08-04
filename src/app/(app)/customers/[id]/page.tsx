import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../CustomerForm";
import { updateCustomerAction, deleteCustomerAction } from "../actions";

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
      <h1 className="text-xl font-bold text-zinc-900">{customer.name}</h1>
      <div className="max-w-lg rounded-xl border border-zinc-200 bg-white p-6">
        <CustomerForm action={updateCustomerAction} customer={customer} submitLabel="更新する" />
      </div>
      <form action={deleteCustomerAction} className="max-w-lg">
        <input type="hidden" name="id" value={customer.id} />
        <button type="submit" className="text-sm text-red-600 underline">
          この顧客を削除する
        </button>
      </form>
    </div>
  );
}
