"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { nextDocumentNumber } from "@/lib/numbering";
import {
  classifyVoiceIntent,
  extractCustomerFieldsFromText,
  extractEmployeeFieldsFromText,
  extractProjectRequestFromText,
} from "@/lib/ai";
import { createDailyReportAction } from "../daily-reports/actions";
import { createKyActivityAction } from "../ky/actions";

export type VoiceEntryFormState = { error?: string } | undefined;

/**
 * ダッシュボードの「話して記録する」窓口。ベテラン・年配の方でも迷わないよう、
 * 「日報・KY・顧客登録・従業員登録・案件依頼」のどれかを選ばせず、話した内容から
 * AIが自動で振り分ける(判定方法は @/lib/ai の classifyVoiceIntent 参照)。
 *
 * 日報・KYは現場(project)に紐づくため現場の選択が必須。顧客・従業員・案件依頼は
 * 現場を選ばなくても登録できるため、分類が判明してから初めて現場の要否を判定する
 * (先に現場選択を必須にすると、顧客登録したいだけの人が無駄な手順を踏むことになるため)。
 */
export async function submitVoiceEntryAction(
  _prevState: VoiceEntryFormState,
  formData: FormData
): Promise<VoiceEntryFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const transcript = String(formData.get("transcript") ?? "").trim();

  if (!transcript) return { error: "マイクで話すか、内容を入力してください。" };

  const intent = await classifyVoiceIntent(transcript, {
    companyId: user.companyId,
    userId: user.id,
    feature: "voiceEntry.classifyIntent",
  });
  const today = new Date().toISOString().slice(0, 10);

  if (intent === "KY" || intent === "DAILY_REPORT") {
    if (!projectId) {
      return {
        error:
          intent === "KY"
            ? "危険予知の内容のようです。現場を選択してから、もう一度送信してください。"
            : "日報の内容のようです。現場を選択してから、もう一度送信してください。",
      };
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId: user.companyId } });
    if (!project) return { error: "現場が見つかりません。" };

    if (intent === "KY") {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("activityDate", today);
      fd.set("workContent", transcript);
      return createKyActivityAction(undefined, fd);
    }
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("reportDate", today);
    fd.set("rawVoiceInput", transcript);
    return createDailyReportAction(undefined, fd);
  }

  if (intent === "CUSTOMER") {
    const extraction = await extractCustomerFieldsFromText(transcript, {
      companyId: user.companyId,
      userId: user.id,
      feature: "voiceEntry.extractCustomer",
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: user.companyId,
        name: extraction.companyName ?? "(名称未確認・要編集)",
        contactName: extraction.personName,
        position: extraction.position,
        department: extraction.department,
        postalCode: extraction.postalCode,
        phone: extraction.phone,
        mobilePhone: extraction.mobilePhone,
        fax: extraction.fax,
        email: extraction.email,
        websiteUrl: extraction.companyUrl,
        address: extraction.address,
        notes: extraction.notes,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "customer.createFromVoice",
      targetType: "Customer",
      targetId: customer.id,
    });
    redirect(`/customers/${customer.id}`);
  }

  if (intent === "EMPLOYEE") {
    const extraction = await extractEmployeeFieldsFromText(transcript, {
      companyId: user.companyId,
      userId: user.id,
      feature: "voiceEntry.extractEmployee",
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: user.companyId,
        name: extraction.name ?? "(氏名未確認・要編集)",
        nameKana: extraction.nameKana,
        position: extraction.position,
        email: extraction.email,
        phone: extraction.phone,
        notes: extraction.notes,
      },
    });
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      action: "employee.createFromVoice",
      targetType: "Employee",
      targetId: employee.id,
    });
    redirect(`/employees/${employee.id}`);
  }

  // intent === "PROJECT_REQUEST"
  const extraction = await extractProjectRequestFromText(transcript, {
    companyId: user.companyId,
    userId: user.id,
    feature: "voiceEntry.extractProjectRequest",
  });
  const matchedCustomer = extraction.customerName
    ? await prisma.customer.findFirst({
        where: { companyId: user.companyId, name: { contains: extraction.customerName, mode: "insensitive" } },
      })
    : null;

  if (!matchedCustomer) {
    // 顧客が一致しないと案件を作れない(Project.customerIdは必須)。案件登録画面へ
    // 読み取り済みの内容を引き継ぎ、顧客だけ手動で選択・登録してもらう。
    redirect(`/projects/new?prefillTranscript=${encodeURIComponent(transcript)}`);
  }

  const projectCode = await nextDocumentNumber(user.companyId, "PROJECT");
  const project = await prisma.project.create({
    data: {
      companyId: user.companyId,
      customerId: matchedCustomer.id,
      projectCode,
      name: extraction.projectName ?? "(案件名未確認・要編集)",
      siteAddress: extraction.siteAddress,
      primeContractorName: extraction.primeContractorName,
      overview: [extraction.workContent, extraction.quantity].filter(Boolean).join("\n") || null,
      startDate: extraction.startDate ? new Date(extraction.startDate) : null,
      endDate: extraction.endDate ? new Date(extraction.endDate) : null,
      contactName: extraction.contactName,
      contactPhone: extraction.contactPhone,
      castingDate: extraction.castingDate ? new Date(extraction.castingDate) : null,
      suppliedItems: extraction.suppliedItems,
      soilQuantity: extraction.soilQuantity,
      cautions: extraction.cautions,
    },
  });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "project.createFromVoice",
    targetType: "Project",
    targetId: project.id,
  });
  redirect(`/projects/${project.id}`);
}
