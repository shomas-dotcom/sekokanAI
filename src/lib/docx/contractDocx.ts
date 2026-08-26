import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ContractClause } from "@/lib/contractClauses";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("ja-JP") : "未定(要確認)";
}

function fmtYen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

function tableRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: 75, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value)],
      }),
    ],
  });
}

export type ContractDocxInput = {
  contractNumber: string;
  contractDate: Date;
  projectName: string;
  siteAddress: string | null;
  customerName: string;
  customerAddress: string | null;
  companyName: string;
  companyAddress: string | null;
  companyRepresentative: string | null;
  companyLicenseNumber: string | null;
  contractAmountExcludingTax: number;
  taxAmount: number;
  contractAmountIncludingTax: number;
  startDate: Date | null;
  endDate: Date | null;
  paymentTerms: string | null;
  clauses: ContractClause[];
};

/**
 * 工事請負契約書のDOCXを生成する(ユーザーが編集できる形式で出力する要件、REQUIREMENTS.md #9)。
 */
export async function buildContractDocx(input: ContractDocxInput): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "工事請負契約書",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "発注者(以下「甲」という。)と受注者(以下「乙」という。)は、次の工事について、以下の条項により工事請負契約を締結する。",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              tableRow("契約番号", input.contractNumber),
              tableRow("契約日", fmtDate(input.contractDate)),
              tableRow("工事名", input.projectName),
              tableRow("工事場所", input.siteAddress ?? "要確認"),
              tableRow(
                "発注者(甲)",
                `${input.customerName}${input.customerAddress ? " / " + input.customerAddress : ""}`
              ),
              tableRow(
                "受注者(乙)",
                [
                  input.companyName,
                  input.companyAddress,
                  input.companyRepresentative ? `代表者: ${input.companyRepresentative}` : null,
                  input.companyLicenseNumber ? `建設業許可: ${input.companyLicenseNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(" / ")
              ),
              tableRow("契約金額(税抜)", fmtYen(input.contractAmountExcludingTax)),
              tableRow("消費税額", fmtYen(input.taxAmount)),
              tableRow("契約金額(税込)", fmtYen(input.contractAmountIncludingTax)),
              tableRow("工期", `${fmtDate(input.startDate)} 〜 ${fmtDate(input.endDate)}`),
              tableRow("支払条件", input.paymentTerms ?? "要確認"),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          ...input.clauses.flatMap((clause) => [
            new Paragraph({
              children: [new TextRun({ text: clause.title, bold: true })],
              spacing: { before: 200 },
            }),
            ...clause.text.split("\n").map((line) => new Paragraph(line)),
          ]),
          new Paragraph({
            text: "本契約書は一般的なひな形です。個別案件の内容、取引条件、法令および発注者指定条件に応じて、行政書士、弁護士、税理士等の専門家へ確認してください。",
            spacing: { before: 300 },
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
