import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildInvoiceXlsx } from "@/lib/xlsx/invoiceXlsx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      items: { orderBy: { sortOrder: "asc" } },
      company: true,
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "請求書が見つかりません。" }, { status: 404 });
  }

  const buffer = await buildInvoiceXlsx({
    companyName: invoice.company.name,
    companyPostalCode: invoice.company.postalCode,
    companyAddress: invoice.company.address,
    companyPhone: invoice.company.phone,
    companyInvoiceRegistrationNumber: invoice.company.invoiceRegistrationNumber,
    companyBankName: invoice.company.bankName,
    companyBankBranch: invoice.company.bankBranch,
    companyBankAccountType: invoice.company.bankAccountType,
    companyBankAccountNumber: invoice.company.bankAccountNumber,
    companyBankAccountHolder: invoice.company.bankAccountHolder,
    customerName: invoice.project.customer.name,
    customerAddress: invoice.project.customer.address,
    invoiceNumber: invoice.invoiceNumber,
    issueDateText: new Date(invoice.issueDate).toLocaleDateString("ja-JP"),
    dueDateText: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("ja-JP") : null,
    projectName: invoice.project.name,
    items: invoice.items.map((item) => ({
      itemName: item.itemName,
      spec: item.spec,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    })),
    subtotal: invoice.subtotal,
    taxRatePercent: invoice.taxRatePercent,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    notes: invoice.notes,
  });

  const filename = `請求書_${invoice.invoiceNumber}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
