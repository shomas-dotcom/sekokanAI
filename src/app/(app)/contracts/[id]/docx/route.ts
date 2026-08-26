import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildContractDocx } from "@/lib/docx/contractDocx";
import type { ContractClause } from "@/lib/contractClauses";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { include: { customer: true } }, company: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "契約書が見つかりません。" }, { status: 404 });
  }

  const clauses = JSON.parse(contract.clausesJson) as ContractClause[];

  const buffer = await buildContractDocx({
    contractNumber: contract.contractNumber,
    contractDate: contract.contractDate,
    projectName: contract.project.name,
    siteAddress: contract.project.siteAddress,
    customerName: contract.project.customer.name,
    customerAddress: contract.project.customer.address,
    companyName: contract.company.name,
    companyAddress: contract.company.address,
    companyRepresentative: contract.company.representativeName,
    companyLicenseNumber: contract.company.licenseNumber,
    contractAmountExcludingTax: contract.contractAmountExcludingTax,
    taxAmount: contract.taxAmount,
    contractAmountIncludingTax: contract.contractAmountIncludingTax,
    startDate: contract.startDate,
    endDate: contract.endDate,
    paymentTerms: contract.paymentTerms,
    clauses,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${contract.contractNumber}.docx"`,
    },
  });
}
