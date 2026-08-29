import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Textarea, Button, Badge, FieldLabel } from "@/components/ui";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_COLOR } from "../statusLabel";
import type { ContractClause } from "@/lib/contractClauses";
import {
  updateContractMetaAction,
  updateContractClausesAction,
  confirmContractAction,
  cancelContractAction,
  deleteContractAction,
} from "../actions";
import { Tabs } from "@/components/Tabs";
import { EntityFileSection } from "@/components/entityFiles/EntityFileSection";
import { TextareaWithVoice } from "@/components/TextareaWithVoice";

function toDateInputValue(value: Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ referencedContract?: string }>;
}) {
  const { id } = await params;
  const { referencedContract } = await searchParams;
  const user = await requireUser();

  const [contract, files] = await Promise.all([
    prisma.contract.findFirst({
      where: { id, companyId: user.companyId },
      include: { project: { include: { customer: true } }, invoices: true },
    }),
    prisma.entityFile.findMany({
      where: { entityType: "CONTRACT", entityId: id, companyId: user.companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!contract) notFound();

  const clauses = JSON.parse(contract.clausesJson) as ContractClause[];
  const isDraft = contract.status === "DRAFT";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {contract.contractNumber}
          </h1>
          <p className="text-sm text-slate-500">
            {contract.project.customer.name} / {contract.project.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={CONTRACT_STATUS_COLOR[contract.status]}>
            {CONTRACT_STATUS_LABEL[contract.status]}
          </Badge>
          <Link
            href={`/contracts/${contract.id}/print`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            印刷 / PDF保存
          </Link>
          <a
            href={`/contracts/${contract.id}/docx`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Wordで出力
          </a>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            label: "基本情報",
            content: (
              <div className="flex flex-col gap-6">
      {referencedContract && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          前回の契約({referencedContract})を元に作成しました。工事内容・契約金額・工期・支払方法(第1〜4条)は今回の案件の内容に更新済みです。それ以外の条項・特約事項は前回と同じ内容を引き継いでいるので、内容に問題ないか確認してください。
        </div>
      )}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        本システムで作成される文書は一般的なひな形です。個別案件の内容、取引条件、法令および発注者指定条件に応じて、行政書士、弁護士、税理士等の専門家へ確認してください。
      </div>

      {!isDraft && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          この契約書は{CONTRACT_STATUS_LABEL[contract.status]}です。内容は確定時点のスナップショットとして保存されており、案件情報を変更しても変わりません。
        </div>
      )}

      <Card>
        <h2 className="font-semibold text-slate-900">契約金額・工期</h2>
        <form
          action={updateContractMetaAction}
          className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={contract.id} />
          <FieldLabel label="契約日">
            <Input
              type="date"
              name="contractDate"
              defaultValue={toDateInputValue(contract.contractDate)}
              disabled={!isDraft}
            />
          </FieldLabel>
          <div />
          <FieldLabel label="契約金額(税抜)">
            <Input
              type="number"
              name="contractAmountExcludingTax"
              defaultValue={contract.contractAmountExcludingTax}
              disabled={!isDraft}
            />
          </FieldLabel>
          <FieldLabel label="消費税率(%)">
            <Input
              type="number"
              name="taxRatePercent"
              defaultValue={contract.taxRatePercent}
              disabled={!isDraft}
            />
          </FieldLabel>
          <FieldLabel label="工期(着手)">
            <Input
              type="date"
              name="startDate"
              defaultValue={toDateInputValue(contract.startDate)}
              disabled={!isDraft}
            />
          </FieldLabel>
          <FieldLabel label="工期(完成)">
            <Input
              type="date"
              name="endDate"
              defaultValue={toDateInputValue(contract.endDate)}
              disabled={!isDraft}
            />
          </FieldLabel>
          <FieldLabel label="支払条件">
            <Input name="paymentTerms" defaultValue={contract.paymentTerms ?? ""} disabled={!isDraft} />
          </FieldLabel>
          <FieldLabel label="瑕疵・契約不適合対応(任意)">
            <Input name="warrantyTerms" defaultValue={contract.warrantyTerms ?? ""} disabled={!isDraft} />
          </FieldLabel>
          <FieldLabel label="工期変更時の対応(任意)">
            <Input name="delayTerms" defaultValue={contract.delayTerms ?? ""} disabled={!isDraft} />
          </FieldLabel>
          <FieldLabel label="契約解除条件(任意)">
            <Input
              name="cancellationTerms"
              defaultValue={contract.cancellationTerms ?? ""}
              disabled={!isDraft}
            />
          </FieldLabel>
          <FieldLabel label="特約事項(任意)">
            <TextareaWithVoice name="specialTerms" rows={2} defaultValue={contract.specialTerms ?? ""} disabled={!isDraft} />
          </FieldLabel>

          <div className="sm:col-span-2 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-slate-500">消費税額</p>
              <p className="font-semibold text-slate-900">{contract.taxAmount.toLocaleString("ja-JP")}円</p>
            </div>
            <div>
              <p className="text-slate-500">契約金額(税込)</p>
              <p className="font-semibold text-slate-900">
                {contract.contractAmountIncludingTax.toLocaleString("ja-JP")}円
              </p>
            </div>
          </div>

          {isDraft && (
            <Button type="submit" variant="secondary" className="w-fit sm:col-span-2">
              更新する
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">契約条項</h2>
        <p className="mt-1 text-xs text-slate-500">
          一般的なひな形の条項です。案件の実情に合わせて編集してください。
        </p>
        <form action={updateContractClausesAction} className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="id" value={contract.id} />
          {clauses.map((clause) => (
            <FieldLabel key={clause.key} label={clause.title}>
              <Textarea
                name={`clause_${clause.key}`}
                rows={3}
                defaultValue={clause.text}
                disabled={!isDraft}
              />
            </FieldLabel>
          ))}
          {isDraft && (
            <Button type="submit" variant="secondary" className="w-fit">
              条項を保存
            </Button>
          )}
        </form>
      </Card>

      {contract.invoices.length > 0 && (
        <Card>
          <h2 className="font-semibold text-slate-900">この契約の請求書</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {contract.invoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="text-orange-700 underline">
                  {inv.invoiceNumber}
                </Link>{" "}
                <span className="text-slate-500">
                  ({inv.currentBilledAmount.toLocaleString("ja-JP")}円)
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {isDraft && (
          <form action={confirmContractAction}>
            <input type="hidden" name="id" value={contract.id} />
            <Button type="submit">この内容で契約を確定する</Button>
          </form>
        )}
        {!isDraft && contract.status !== "CANCELLED" && (
          <form action={cancelContractAction}>
            <input type="hidden" name="id" value={contract.id} />
            <Button type="submit" variant="secondary">
              契約を取消にする
            </Button>
          </form>
        )}
        {isDraft && (
          <form action={deleteContractAction}>
            <input type="hidden" name="id" value={contract.id} />
            <Button type="submit" variant="danger">
              この契約書を削除する
            </Button>
          </form>
        )}
      </div>
              </div>
            ),
          },
          {
            label: "ファイル参照",
            content: <EntityFileSection entityType="CONTRACT" entityId={contract.id} files={files} />,
          },
        ]}
      />
    </div>
  );
}
