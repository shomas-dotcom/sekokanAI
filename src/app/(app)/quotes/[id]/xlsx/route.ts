import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuoteTotals } from "../../totals";
import { buildQuoteXlsx, type QuoteXlsxInput } from "@/lib/xlsx/quoteXlsx";
import { buildQuoteXlsxFromTemplate, QuoteTemplateTooManyItemsError } from "@/lib/xlsx/quoteTemplateXlsx";

function periodText(start: Date | null, end: Date | null): string | null {
  if (!start) return null;
  const fmt = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return end ? `${fmt(start)}〜${fmt(end)}` : fmt(start);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const xlsxInput: QuoteXlsxInput = {
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
      remarks: item.remarks,
    })),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxRatePercent: quote.taxRatePercent,
    tax: totals.tax,
    total: totals.total,
    notes: quote.notes,
  };

  // すでにこの見積で使う雛形が固定されていれば、それを使う(発行後に雛形を選び直しても変わらない)。
  // まだ固定されていなければ、指定があればここで固定する(最初の出力=発行とみなす)。
  let templateVersionId = quote.templateVersionId;
  const requestedTemplateVersionId = new URL(request.url).searchParams.get("templateVersionId");
  if (!templateVersionId && requestedTemplateVersionId) {
    const requested = await prisma.quoteTemplateVersion.findFirst({
      where: { id: requestedTemplateVersionId, template: { companyId: user.companyId } },
    });
    if (requested && requested.itemMaxRows > 0) {
      await prisma.quote.update({ where: { id: quote.id }, data: { templateVersionId: requested.id } });
      templateVersionId = requested.id;
    }
  }

  let buffer;
  if (templateVersionId) {
    const version = await prisma.quoteTemplateVersion.findUnique({ where: { id: templateVersionId } });
    if (!version) {
      return NextResponse.json({ error: "指定された雛形が見つかりません。" }, { status: 404 });
    }
    try {
      buffer = await buildQuoteXlsxFromTemplate(
        {
          fileData: Buffer.from(version.fileData),
          sheetName: version.sheetName,
          fieldMappingJson: version.fieldMappingJson,
          itemSheetName: version.itemSheetName,
          itemStartRow: version.itemStartRow,
          itemMaxRows: version.itemMaxRows,
          itemColumnsJson: version.itemColumnsJson,
        },
        xlsxInput
      );
    } catch (error) {
      if (error instanceof QuoteTemplateTooManyItemsError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } else {
    buffer = await buildQuoteXlsx(xlsxInput);
  }

  const filename = `見積書_${quote.title}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
