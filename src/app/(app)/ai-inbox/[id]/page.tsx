import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Textarea, Button, FieldLabel } from "@/components/ui";
import { approveAiIntakeAction, rejectAiIntakeAction } from "../actions";
import type { AiIntakeResult } from "@/lib/ai";

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  BUSINESS_CARD: "名刺",
  ESTIMATE_REQUEST: "見積依頼",
  ESTIMATE: "見積書",
  CONTRACT: "契約書",
  INVOICE: "請求書",
  EMPLOYEE_ID: "身分証",
  PROJECT_MESSAGE: "工事の依頼文",
  UNKNOWN: "種類を判定できませんでした",
};

type StoredExtraction = AiIntakeResult & {
  matchedCustomerId: string | null;
  duplicateCustomers: { id: string; name: string; phone: string | null; email: string | null }[];
};

export default async function AiInboxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  const extraction = await prisma.aiExtraction.findFirst({ where: { id, companyId: user.companyId } });
  if (!extraction) notFound();

  const data = JSON.parse(extraction.extractedJson) as StoredExtraction;

  if (extraction.status === "FAILED") {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI解析結果</h1>
        <Card className="border-rose-200 bg-rose-50">
          <p className="font-semibold text-rose-800">解析できませんでした</p>
          <p className="mt-1 text-sm text-rose-700">{extraction.errorMessage}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              もう一度試す
            </Link>
            <Link href="/customers/new" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              顧客を手入力する
            </Link>
            <Link href="/projects/new" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              案件を手入力する
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (extraction.status !== "REVIEW_REQUIRED") {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI解析結果</h1>
        <Card>
          <p className="text-sm text-slate-600">
            この内容はすでに{extraction.status === "APPROVED" ? "登録済み" : "却下済み"}です。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {extraction.resultCustomerId && (
              <Link href={`/customers/${extraction.resultCustomerId}`} className="text-sm text-orange-700 underline">
                登録された顧客を見る
              </Link>
            )}
            {extraction.resultProjectId && (
              <Link href={`/projects/${extraction.resultProjectId}`} className="text-sm text-orange-700 underline">
                登録された案件を見る
              </Link>
            )}
            {extraction.resultEmployeeId && (
              <Link href={`/employees/${extraction.resultEmployeeId}`} className="text-sm text-orange-700 underline">
                登録された従業員を見る
              </Link>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const { customer, project, employee } = data;
  const hasCustomer = Boolean(customer);
  const hasProject = Boolean(project);
  const hasEmployee = Boolean(employee);

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI解析結果</h1>
      <p className="text-sm text-slate-500">
        種類: <span className="font-semibold text-slate-700">{DOCUMENT_TYPE_LABEL[extraction.documentType]}</span>
        {extraction.sourceSummary && <span className="ml-2 text-xs text-slate-400">({extraction.sourceSummary})</span>}
      </p>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      )}

      {data.confidence === "needs_review" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ 一部の項目しか読み取れなかったか、種類の判定に自信がありません。内容をよく確認してください。
        </div>
      )}

      {!hasCustomer && !hasProject && !hasEmployee && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          書類の種類を自動判定できませんでした。お手数ですが、下記から手入力で登録してください。
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/customers/new" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              顧客を登録する
            </Link>
            <Link href="/projects/new" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              案件を登録する
            </Link>
            <Link href="/employees/new" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm">
              従業員を登録する
            </Link>
          </div>
        </div>
      )}

      {(hasCustomer || hasProject || hasEmployee) && (
        <form action={approveAiIntakeAction} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={extraction.id} />

          {hasCustomer && (
            <Card>
              <h2 className="font-semibold text-slate-900">顧客</h2>
              {data.duplicateCustomers.length > 0 && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠ 既存顧客の可能性があります:{" "}
                  {data.duplicateCustomers.map((d) => (
                    <Link key={d.id} href={`/customers/${d.id}`} target="_blank" className="underline">
                      {d.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerChoice"
                    value="new"
                    defaultChecked={data.duplicateCustomers.length === 0}
                  />
                  新しい顧客として登録する
                </label>
                {data.duplicateCustomers.length > 0 && (
                  <label className="flex items-center gap-2">
                    <input type="radio" name="customerChoice" value="existing" defaultChecked />
                    既存の顧客に紐付ける:
                    <select
                      name="existingCustomerId"
                      defaultValue={data.matchedCustomerId ?? data.duplicateCustomers[0]?.id}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    >
                      {data.duplicateCustomers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="会社名/顧客名">
                  <Input name="customerName" defaultValue={customer?.companyName ?? ""} />
                </FieldLabel>
                <FieldLabel label="担当者名">
                  <Input name="customerContactName" defaultValue={customer?.personName ?? ""} />
                </FieldLabel>
                <FieldLabel label="電話番号">
                  <Input name="customerPhone" defaultValue={customer?.phone ?? customer?.mobilePhone ?? ""} />
                </FieldLabel>
                <FieldLabel label="メールアドレス">
                  <Input name="customerEmail" defaultValue={customer?.email ?? ""} />
                </FieldLabel>
                <FieldLabel label="住所">
                  <Input name="customerAddress" defaultValue={customer?.address ?? ""} />
                </FieldLabel>
              </div>
            </Card>
          )}

          {hasProject && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">案件</h2>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" name="createProject" defaultChecked className="accent-amber-600" />
                  案件も登録する
                </label>
              </div>
              {project?.unclearFields && project.unclearFields.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">確認が必要な項目: {project.unclearFields.join("、")}</p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-3">
                <FieldLabel label="工事名" required>
                  <Input name="projectName" defaultValue={project?.projectName ?? ""} />
                </FieldLabel>
                <FieldLabel label="現場住所">
                  <Input name="projectSiteAddress" defaultValue={project?.siteAddress ?? ""} />
                </FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="元請">
                    <Input name="projectPrimeContractorName" defaultValue={project?.primeContractorName ?? ""} />
                  </FieldLabel>
                  <FieldLabel label="発注者側担当者">
                    <Input name="projectContactName" defaultValue={project?.contactName ?? ""} />
                  </FieldLabel>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="工期(着手)">
                    <Input type="date" name="projectStartDate" defaultValue={project?.startDate ?? ""} />
                  </FieldLabel>
                  <FieldLabel label="工期(完成)">
                    <Input type="date" name="projectEndDate" defaultValue={project?.endDate ?? ""} />
                  </FieldLabel>
                </div>
                {project?.periodText && !project.startDate && (
                  <p className="text-xs text-amber-700">工期の原文: {project.periodText}(年が不明なため日付欄には反映していません)</p>
                )}
                <FieldLabel label="工事内容・数量">
                  <Textarea
                    name="projectOverview"
                    rows={3}
                    defaultValue={[project?.workContent, project?.quantity].filter(Boolean).join("\n")}
                  />
                </FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FieldLabel label="支給品">
                    <Input name="projectSuppliedItems" defaultValue={project?.suppliedItems ?? ""} />
                  </FieldLabel>
                  <FieldLabel label="残土数量">
                    <Input name="projectSoilQuantity" defaultValue={project?.soilQuantity ?? ""} />
                  </FieldLabel>
                </div>
                <FieldLabel label="注意事項">
                  <Textarea name="projectCautions" rows={2} defaultValue={project?.cautions ?? ""} />
                </FieldLabel>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                ※ 案件の登録には顧客が必要です。上の「顧客」欄が空欄の場合は登録されません。
              </p>
            </Card>
          )}

          {hasEmployee && (
            <Card>
              <h2 className="font-semibold text-slate-900">従業員</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <FieldLabel label="氏名">
                  <Input name="employeeName" defaultValue={employee?.name ?? ""} />
                </FieldLabel>
                <FieldLabel label="フリガナ">
                  <Input name="employeeNameKana" defaultValue={employee?.nameKana ?? ""} />
                </FieldLabel>
              </div>
              {employee?.licenseType && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <FieldLabel label="保有資格として登録">
                    <Input name="employeeQualificationName" defaultValue={employee.licenseType} />
                  </FieldLabel>
                  <FieldLabel label="有効期限">
                    <Input type="date" name="employeeQualificationExpiresAt" defaultValue={employee.licenseExpiry ?? ""} />
                  </FieldLabel>
                </div>
              )}
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="py-3 text-base">
              この内容で登録
            </Button>
          </div>
        </form>
      )}

      <form action={rejectAiIntakeAction}>
        <input type="hidden" name="id" value={extraction.id} />
        <button type="submit" className="text-sm text-slate-500 underline">
          この内容は登録しない
        </button>
      </form>
    </div>
  );
}
