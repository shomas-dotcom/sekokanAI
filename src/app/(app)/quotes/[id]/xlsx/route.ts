import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "../../totals";
import { buildQuoteXlsx } from "@/lib/xlsx/quoteXlsx";

function periodText(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return end ? `${fmt(start)}〜${fmt(end)}` : fmt(start);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      project: { include: { customer: true } },
      items: { orderBy: { sortOrder: "asc" } },
      company: true,
    },
  });
  if (!quote) {
    return NextResponse.json({ error: "見積が見つかりません。" }, { status: 404 });
  }

  const totals = computeQuoteTotals(quote.items, quote.taxRatePercent, quote.discountAmount);

  const buffer = await buildQuoteXlsx({
    companyName: quote.company.name,
    companyPostalCode: quote.company.postalCode,
    companyAddress: quote.company.address,
    companyPhone: quote.company.phone,
    companyRepresentativeName: quote.company.representativeName,
    customerName: quote.project.customer.name,
    estimateNumber: quote.estimateNumber,
    issueDateText: new Date().toLocaleDateString("ja-JP"),
    projectName: quote.project.name,
    siteAddress: quote.project.siteAddress,
    paymentTerms: quote.project.paymentTerms ?? quote.company.defaultPaymentTerms,
    expirationDateText: quote.expirationDate ? quote.expirationDate.toLocaleDateString("ja-JP") : null,
    periodText: periodText(quote.project.startDate, quote.project.endDate),
    items: quote.items.map((item) => ({
      itemName: item.itemName,
      spec: item.spec,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
    })),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxRatePercent: quote.taxRatePercent,
    tax: totals.tax,
    total: totals.total,
    notes: quote.notes,
  });

  const filename = `見積書_${quote.title}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
