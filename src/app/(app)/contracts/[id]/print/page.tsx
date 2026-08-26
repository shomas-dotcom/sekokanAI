import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/PrintButton";
import type { ContractClause } from "@/lib/contractClauses";

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("ja-JP") : "未定(要確認)";
}

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId },
    include: { project: { include: { customer: true } }, company: true },
  });
  if (!contract) notFound();

  const clauses = JSON.parse(contract.clausesJson) as ContractClause[];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-zinc-900 print:p-0">
      <style>{`@media print { @page { size: A4; margin: 18mm 15mm; } }`}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold">工事請負契約書</h1>
      <p className="mt-4">
        発注者(以下「甲」という。)と受注者(以下「乙」という。)は、次の工事について、以下の条項により工事請負契約を締結する。
      </p>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="font-semibold">工事名</p>
          <p>{contract.project.name}</p>
          <p className="mt-2 font-semibold">工事場所</p>
          <p>{contract.project.siteAddress ?? "要確認"}</p>
        </div>
        <div>
          <p className="font-semibold">契約番号</p>
          <p>{contract.contractNumber}</p>
          <p className="mt-2 font-semibold">契約日</p>
          <p>{fmtDate(contract.contractDate)}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 break-inside-avoid">
        <div className="rounded border border-zinc-300 p-3">
          <p className="text-xs text-zinc-500">発注者(甲)</p>
          <p className="mt-1 font-semibold">{contract.project.customer.name} 御中</p>
          {contract.project.customer.address && <p className="mt-1">{contract.project.customer.address}</p>}
          <div className="mt-8 flex justify-end text-xs text-zinc-500">
            署名または捺印: ______________________
          </div>
        </div>
        <div className="rounded border border-zinc-300 p-3">
          <p className="text-xs text-zinc-500">受注者(乙)</p>
          <p className="mt-1 font-semibold">{contract.company.name}</p>
          {contract.company.postalCode && <p>〒{contract.company.postalCode}</p>}
          {contract.company.address && <p>{contract.company.address}</p>}
          {contract.company.phone && <p>TEL: {contract.company.phone}</p>}
          {contract.company.representativeName && <p>代表者: {contract.company.representativeName}</p>}
          {contract.company.licenseNumber && <p>建設業許可: {contract.company.licenseNumber}</p>}
          <div className="mt-4 flex justify-end text-xs text-zinc-500">社判・署名: ______________________</div>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm break-inside-avoid">
        <tbody>
          <Row label="契約金額(税抜)" value={`${contract.contractAmountExcludingTax.toLocaleString("ja-JP")}円`} />
          <Row label="消費税額" value={`${contract.taxAmount.toLocaleString("ja-JP")}円`} />
          <Row label="契約金額(税込)" value={`${contract.contractAmountIncludingTax.toLocaleString("ja-JP")}円`} bold />
          <Row label="工期" value={`${fmtDate(contract.startDate)} 〜 ${fmtDate(contract.endDate)}`} />
          <Row label="支払条件" value={contract.paymentTerms ?? "要確認"} />
        </tbody>
      </table>

      <div className="mt-6 flex flex-col gap-4">
        {clauses.map((clause) => (
          <div key={clause.key} className="break-inside-avoid">
            <p className="font-semibold">{clause.title}</p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{clause.text}</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        本契約書は一般的なひな形です。個別案件の内容、取引条件、法令および発注者指定条件に応じて、行政書士、弁護士、税理士等の専門家へ確認してください。
      </p>

      <div className="mt-8 text-right text-xs text-zinc-400 [counter-reset:page]">
        {/* ページ番号はブラウザ印刷のページ番号設定を利用する(印刷ダイアログのヘッダー/フッターオプション) */}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-zinc-200">
      <td className="w-40 py-1 text-zinc-500">{label}</td>
      <td className={`py-1 ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}
