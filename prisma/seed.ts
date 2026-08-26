import { prisma } from "../src/lib/prisma";
import { hash } from "../src/lib/password";
import { nextDocumentNumber } from "../src/lib/numbering";
import { computeInvoiceItemsTotal, computeContractAmounts } from "../src/lib/calc";
import { buildDefaultClauses } from "../src/lib/contractClauses";

// デモ用アカウント・案件データ(REQUIREMENTS.md #19)。
// 口座番号・登録番号等はすべて架空のダミー値であり、実在の情報は含まない(SECURITY.md)。
async function main() {
  const company = await prisma.company.upsert({
    where: { id: "demo-company" },
    // 既存デモ会社はフリーミアム導入前からプレミアム機能(見積・施工計画書)を
    // 利用していたため、挙動を変えないようPREMIUMへ移行する。新規登録はFREEが既定。
    update: {
      plan: "PREMIUM",
      postalCode: "350-0000",
      address: "埼玉県坂戸市デモ1-2-3",
      phone: "049-000-0000",
      email: "demo@genba-ai.local",
      representativeName: "デモ 代表",
      licenseNumber: "デモ-000000",
      invoiceRegistrationNumber: "T0000000000000",
      bankName: "デモ銀行",
      bankBranch: "デモ支店",
      bankAccountType: "普通",
      bankAccountNumber: "0000000",
      bankAccountHolder: "スギモトドボク(デモ)",
    },
    create: {
      id: "demo-company",
      name: "杉本土木株式会社(デモ)",
      postalCode: "350-0000",
      address: "埼玉県坂戸市デモ1-2-3",
      phone: "049-000-0000",
      email: "demo@genba-ai.local",
      representativeName: "デモ 代表",
      licenseNumber: "デモ-000000",
      invoiceRegistrationNumber: "T0000000000000",
      bankName: "デモ銀行",
      bankBranch: "デモ支店",
      bankAccountType: "普通",
      bankAccountNumber: "0000000",
      bankAccountHolder: "スギモトドボク(デモ)",
      plan: "PREMIUM",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@genba-ai.local" },
    update: {},
    create: {
      companyId: company.id,
      email: "demo@genba-ai.local",
      passwordHash: await hash("demo-password-change-me"),
      name: "デモ 太郎",
      role: "ADMIN",
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: "demo-customer" },
    update: { name: "株式会社サンプル建設", contactName: "発注 花子", phone: "049-000-0001" },
    create: {
      id: "demo-customer",
      companyId: company.id,
      name: "株式会社サンプル建設",
      contactName: "発注 花子",
      phone: "049-000-0001",
    },
  });

  const existingProject = await prisma.project.findUnique({ where: { id: "demo-project" } });
  const projectCode = existingProject?.projectCode ?? (await nextDocumentNumber(company.id, "PROJECT"));
  const project = await prisma.project.upsert({
    where: { id: "demo-project" },
    update: {
      // projectCodeは既存データへの後付け項目のため、update時にも必ず反映する
      // (含めないと既存プロジェクトが永久にnullのままになり、再実行時に採番だけ
      // 空回りして連番を消費してしまう)。
      projectCode,
      name: "〇〇市道路改良工事",
      siteAddress: "埼玉県〇〇市〇〇町",
      orderingParty: "〇〇市",
      overview: "道路土工、側溝工、舗装工",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-12-20"),
      paymentTerms: "月末締め翌月末払い",
      managerName: "デモ 太郎",
      siteAgentName: "現場 一郎",
      chiefEngineerName: "技術 二郎",
      contractAmountExcludingTax: 5_000_000,
      taxRatePercent: 10,
    },
    create: {
      id: "demo-project",
      companyId: company.id,
      customerId: customer.id,
      projectCode,
      name: "〇〇市道路改良工事",
      siteAddress: "埼玉県〇〇市〇〇町",
      orderingParty: "〇〇市",
      overview: "道路土工、側溝工、舗装工",
      status: "IN_PROGRESS",
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-12-20"),
      paymentTerms: "月末締め翌月末払い",
      managerName: "デモ 太郎",
      siteAgentName: "現場 一郎",
      chiefEngineerName: "技術 二郎",
      contractAmountExcludingTax: 5_000_000,
      taxRatePercent: 10,
    },
  });

  // 見積(明細は税抜小計が5,000,000円になるよう調整した架空の単価)
  const quoteItemsData = [
    { itemName: "掘削工", spec: null, quantity: 100, unit: "m3", unitPrice: 3_000 },
    { itemName: "残土処分", spec: null, quantity: 80, unit: "m3", unitPrice: 3_500 },
    { itemName: "下層路盤工", spec: null, quantity: 500, unit: "m2", unitPrice: 2_500 },
    { itemName: "アスファルト舗装工", spec: null, quantity: 500, unit: "m2", unitPrice: 4_000 },
    { itemName: "U型側溝工", spec: null, quantity: 80, unit: "m", unitPrice: 7_000 },
    { itemName: "交通誘導員", spec: null, quantity: 20, unit: "人日", unitPrice: 15_000 },
    { itemName: "諸経費", spec: null, quantity: 1, unit: "式", unitPrice: 310_000 },
  ] as const;

  const existingQuote = await prisma.quote.findUnique({ where: { id: "demo-quote" } });
  const estimateNumber =
    existingQuote?.estimateNumber ?? (await nextDocumentNumber(company.id, "ESTIMATE"));
  await prisma.quote.upsert({
    where: { id: "demo-quote" },
    update: { title: "〇〇市道路改良工事 見積書", status: "ACCEPTED" },
    create: {
      id: "demo-quote",
      companyId: company.id,
      projectId: project.id,
      estimateNumber,
      title: "〇〇市道路改良工事 見積書",
      status: "ACCEPTED",
      taxRatePercent: 10,
      items: {
        create: quoteItemsData.map((item, index) => ({
          sortOrder: index,
          itemName: item.itemName,
          spec: item.spec,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          priceSource: "COMPANY_RATE",
        })),
      },
    },
  });

  // 契約書(見積確定 → 契約成立のデモ)
  const { taxAmount, contractAmountIncludingTax } = computeContractAmounts(5_000_000, 10);
  const existingContract = await prisma.contract.findUnique({ where: { id: "demo-contract" } });
  const contractNumber =
    existingContract?.contractNumber ?? (await nextDocumentNumber(company.id, "CONTRACT"));
  const clauses = buildDefaultClauses({
    projectName: project.name,
    siteAddress: project.siteAddress,
    overview: project.overview,
    contractAmountExcludingTax: 5_000_000,
    taxAmount,
    contractAmountIncludingTax,
    startDate: project.startDate,
    endDate: project.endDate,
    paymentTerms: project.paymentTerms,
  });
  const contract = await prisma.contract.upsert({
    where: { id: "demo-contract" },
    update: {},
    create: {
      id: "demo-contract",
      companyId: company.id,
      projectId: project.id,
      quoteId: "demo-quote",
      contractNumber,
      contractDate: new Date("2026-08-20"),
      contractAmountExcludingTax: 5_000_000,
      taxRatePercent: 10,
      taxAmount,
      contractAmountIncludingTax,
      startDate: project.startDate,
      endDate: project.endDate,
      paymentTerms: project.paymentTerms,
      clausesJson: JSON.stringify(clauses),
      status: "CONFIRMED",
      confirmedSnapshotJson: JSON.stringify({ clauses, confirmedAt: new Date().toISOString() }),
    },
  });

  // 請求書(着手金30%を発行済みのデモ)
  const depositTotals = computeInvoiceItemsTotal(
    [{ quantity: 1, unitPrice: Math.round(5_000_000 * 0.3) }],
    10
  );
  const existingInvoice = await prisma.invoice.findUnique({ where: { id: "demo-invoice-deposit" } });
  const invoiceNumber =
    existingInvoice?.invoiceNumber ?? (await nextDocumentNumber(company.id, "INVOICE"));
  await prisma.invoice.upsert({
    where: { id: "demo-invoice-deposit" },
    update: {},
    create: {
      id: "demo-invoice-deposit",
      companyId: company.id,
      projectId: project.id,
      contractId: contract.id,
      invoiceNumber,
      issueDate: new Date("2026-08-25"),
      dueDate: new Date("2026-09-30"),
      billingType: "DEPOSIT",
      subtotal: depositTotals.subtotal,
      taxRatePercent: 10,
      taxAmount: depositTotals.tax,
      total: depositTotals.total,
      previousBilledAmount: 0,
      currentBilledAmount: depositTotals.total,
      cumulativeBilledAmount: depositTotals.total,
      remainingAmount: contractAmountIncludingTax - depositTotals.total,
      status: "ISSUED",
      issuedSnapshotJson: JSON.stringify({ confirmedAt: new Date().toISOString() }),
      items: {
        create: [
          {
            sortOrder: 0,
            itemName: "着手金(契約金額の30%)",
            quantity: 1,
            unit: "式",
            unitPrice: Math.round(5_000_000 * 0.3),
          },
        ],
      },
    },
  });

  // 作業内容マスタ(汎用的な工種の一般名称。特定の受発注先データは含まない)
  const workItemLabels = [
    "掘削",
    "砕石",
    "型枠",
    "配筋",
    "コンクリート",
    "舗装",
    "ブロック積み",
    "フェンス",
    "土間",
    "残土処分",
  ];
  for (const [index, label] of workItemLabels.entries()) {
    await prisma.workItemMaster.upsert({
      where: { id: `demo-work-item-${index + 1}` },
      update: { label, sortOrder: index },
      create: { id: `demo-work-item-${index + 1}`, companyId: company.id, label, sortOrder: index },
    });
  }

  console.log("Seed complete:", { companyId: company.id, projectId: project.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
