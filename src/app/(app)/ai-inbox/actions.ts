"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import { validateAiDocumentFile } from "@/lib/fileValidation";
import { analyzeAiIntakeFromText, analyzeAiIntakeFromImage, analyzeAiIntakeFromPdf, type AiIntakeResult } from "@/lib/ai";
import type { AiDocumentType } from "@/generated/prisma/enums";

export type AiIntakeSubmitState = { error?: string } | undefined;

const DOCUMENT_TYPE_MAP: Record<AiIntakeResult["documentType"], AiDocumentType> = {
  business_card: "BUSINESS_CARD",
  estimate_request: "ESTIMATE_REQUEST",
  estimate: "ESTIMATE",
  contract: "CONTRACT",
  invoice: "INVOICE",
  employee_id: "EMPLOYEE_ID",
  project_message: "PROJECT_MESSAGE",
  unknown: "UNKNOWN",
};

/**
 * ダッシュボードの「AIかんたん登録」窓口。撮影・添付・貼り付け・音声のいずれかで
 * 受け取った内容を判定・抽出し、AiExtraction(ai_inbox)へ一時保存するだけで
 * DB本体テーブルへは書き込まない。確認画面(approveAiIntakeAction)でユーザーが
 * 「この内容で登録」を押して初めて確定する。
 */
export async function submitAiIntakeAction(
  _prevState: AiIntakeSubmitState,
  formData: FormData
): Promise<AiIntakeSubmitState> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");

  let result: AiIntakeResult;
  let sourceSummary: string;

  if (file instanceof File && file.size > 0) {
    const validationError = validateAiDocumentFile(file);
    if (validationError) return { error: validationError };

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    result =
      file.type === "application/pdf"
        ? await analyzeAiIntakeFromPdf(base64)
        : await analyzeAiIntakeFromImage(base64, file.type as "image/jpeg" | "image/png" | "image/webp");
    sourceSummary = file.name;
  } else if (text) {
    result = await analyzeAiIntakeFromText(text);
    sourceSummary = text.slice(0, 40);
  } else {
    return { error: "写真・ファイルを選択するか、文面を入力・音声で話してください。" };
  }

  // 顧客候補があれば、既存顧客との重複・一致を先に調べておく(確認画面でそのまま使う)
  let matchedCustomerId: string | null = null;
  let duplicateCustomers: { id: string; name: string; phone: string | null; email: string | null }[] = [];
  if (result.customer) {
    const orConditions: Array<Record<string, unknown>> = [];
    if (result.customer.companyName) {
      orConditions.push({ name: { contains: result.customer.companyName, mode: "insensitive" } });
    }
    if (result.customer.phone) orConditions.push({ phone: result.customer.phone });
    if (result.customer.mobilePhone) orConditions.push({ phone: result.customer.mobilePhone });
    if (result.customer.email) orConditions.push({ email: result.customer.email });
    if (orConditions.length > 0) {
      duplicateCustomers = await prisma.customer.findMany({
        where: { companyId: user.companyId, OR: orConditions },
        select: { id: true, name: true, phone: true, email: true },
        take: 5,
      });
      matchedCustomerId = duplicateCustomers[0]?.id ?? null;
    }
  } else if (result.project?.customerName) {
    const matched = await prisma.customer.findFirst({
      where: { companyId: user.companyId, name: { contains: result.project.customerName, mode: "insensitive" } },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (matched) {
      matchedCustomerId = matched.id;
      duplicateCustomers = [matched];
    }
  }

  const status = result.confidence === "unavailable" ? "FAILED" : "REVIEW_REQUIRED";
  const extraction = await prisma.aiExtraction.create({
    data: {
      companyId: user.companyId,
      createdByUserId: user.id,
      documentType: DOCUMENT_TYPE_MAP[result.documentType],
      status,
      sourceSummary,
      extractedJson: JSON.stringify({ ...result, matchedCustomerId, duplicateCustomers }),
      errorMessage:
        result.confidence === "unavailable"
          ? "読み取れませんでした。AI連携が設定されていないか、通信に失敗した可能性があります。"
          : null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "aiExtraction.create",
    targetType: "AiExtraction",
    targetId: extraction.id,
  });

  revalidatePath("/dashboard");
  redirect(`/ai-inbox/${extraction.id}`);
}

/**
 * 確認画面の「この内容で登録」。ここで初めて顧客・案件・従業員の本体テーブルへ
 * 書き込む。フォームで修正された値をそのまま使う(抽出結果を無条件に信用しない)。
 * useActionStateを使わない素朴な<form action>のため、エラーはクエリパラメータ
 * 経由で伝える(/settings, /invoicesの操作ボタンと同じ方式)。
 */
export async function approveAiIntakeAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const extraction = await prisma.aiExtraction.findFirst({ where: { id, companyId: user.companyId } });
  if (!extraction) redirect("/dashboard");
  if (extraction!.status !== "REVIEW_REQUIRED") redirect(`/ai-inbox/${id}`);

  const customerChoice = String(formData.get("customerChoice") ?? "none"); // "new" | "existing" | "none"
  const existingCustomerId = String(formData.get("existingCustomerId") ?? "").trim() || null;
  const createProject = formData.get("createProject") === "on";

  let resultCustomerId: string | null = null;
  let resultProjectId: string | null = null;
  let resultEmployeeId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      // --- 顧客 ---
      if (customerChoice === "existing" && existingCustomerId) {
        const existing = await tx.customer.findFirst({
          where: { id: existingCustomerId, companyId: user.companyId },
        });
        if (!existing) throw new Error("選択された既存顧客が見つかりません。");
        resultCustomerId = existing.id;
      } else if (customerChoice === "new") {
        const name = String(formData.get("customerName") ?? "").trim();
        if (!name) throw new Error("顧客名を入力してください。");
        const created = await tx.customer.create({
          data: {
            companyId: user.companyId,
            name,
            contactName: String(formData.get("customerContactName") ?? "").trim() || null,
            phone: String(formData.get("customerPhone") ?? "").trim() || null,
            email: String(formData.get("customerEmail") ?? "").trim() || null,
            address: String(formData.get("customerAddress") ?? "").trim() || null,
          },
        });
        resultCustomerId = created.id;
      }

      // --- 案件(顧客が決まっている場合のみ) ---
      if (createProject && resultCustomerId) {
        const projectName = String(formData.get("projectName") ?? "").trim();
        if (projectName) {
          const startDateStr = String(formData.get("projectStartDate") ?? "").trim();
          const endDateStr = String(formData.get("projectEndDate") ?? "").trim();
          const projectCode = await nextDocumentNumber(user.companyId, "PROJECT");
          const createdProject = await tx.project.create({
            data: {
              companyId: user.companyId,
              customerId: resultCustomerId,
              projectCode,
              name: projectName,
              siteAddress: String(formData.get("projectSiteAddress") ?? "").trim() || null,
              primeContractorName: String(formData.get("projectPrimeContractorName") ?? "").trim() || null,
              contactName: String(formData.get("projectContactName") ?? "").trim() || null,
              contactPhone: String(formData.get("projectContactPhone") ?? "").trim() || null,
              overview: String(formData.get("projectOverview") ?? "").trim() || null,
              suppliedItems: String(formData.get("projectSuppliedItems") ?? "").trim() || null,
              soilQuantity: String(formData.get("projectSoilQuantity") ?? "").trim() || null,
              cautions: String(formData.get("projectCautions") ?? "").trim() || null,
              startDate: startDateStr ? new Date(startDateStr) : null,
              endDate: endDateStr ? new Date(endDateStr) : null,
            },
          });
          resultProjectId = createdProject.id;
        }
      }

      // --- 従業員(身分証の場合) ---
      const employeeName = String(formData.get("employeeName") ?? "").trim();
      if (employeeName) {
        const createdEmployee = await tx.employee.create({
          data: {
            companyId: user.companyId,
            name: employeeName,
            nameKana: String(formData.get("employeeNameKana") ?? "").trim() || null,
          },
        });
        const qualificationName = String(formData.get("employeeQualificationName") ?? "").trim();
        if (qualificationName) {
          const expiresAtStr = String(formData.get("employeeQualificationExpiresAt") ?? "").trim();
          await tx.employeeQualification.create({
            data: {
              employeeId: createdEmployee.id,
              name: qualificationName,
              expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
            },
          });
        }
        resultEmployeeId = createdEmployee.id;
      }

      if (!resultCustomerId && !resultProjectId && !resultEmployeeId) {
        throw new Error("登録する内容がありません。");
      }

      await tx.aiExtraction.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          resultCustomerId,
          resultProjectId,
          resultEmployeeId,
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "登録に失敗しました。";
    redirect(`/ai-inbox/${id}?error=${encodeURIComponent(message)}`);
  }

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "aiExtraction.approve",
    targetType: "AiExtraction",
    targetId: id,
  });

  revalidatePath("/dashboard");
  if (resultProjectId) redirect(`/projects/${resultProjectId}`);
  if (resultCustomerId) redirect(`/customers/${resultCustomerId}`);
  if (resultEmployeeId) redirect(`/employees/${resultEmployeeId}`);
  redirect("/dashboard");
}

export async function rejectAiIntakeAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.aiExtraction.updateMany({
    where: { id, companyId: user.companyId, status: { in: ["REVIEW_REQUIRED", "FAILED"] } },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
