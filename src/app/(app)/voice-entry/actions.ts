"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { classifyVoiceIntent } from "@/lib/ai";
import { createDailyReportAction } from "../daily-reports/actions";
import { createKyActivityAction } from "../ky/actions";

export type VoiceEntryFormState = { error?: string; notice?: string } | undefined;

/**
 * ダッシュボードの「AIに話す」窓口(音声AIルーターのMVP)。ベテラン・年配の方でも
 * 迷わないよう、「日報・KY・見積・請求・施工計画・顧客登録・従業員登録・案件依頼」の
 * どれかを選ばせず、話した内容からAIが自動で振り分ける(判定方法は @/lib/ai の
 * classifyVoiceIntent 参照)。
 *
 * 重要: AIは「これは○○の内容のようです」と判定するだけで、AI自身が顧客・案件・
 * 見積等をこの場で確定・登録することはしない。判定後は必ず各機能の登録画面
 * (すでに写真添付・資料添付・音声入力タブや確認欄を備えている画面)へ、話した
 * 内容を引き継いだ状態で遷移し、そこで人が内容を確認してから登録する。
 * これはコード変更(2026-09追記)で、以前はCUSTOMER/EMPLOYEE/PROJECT_REQUESTを
 * この場で直接DBへ作成していたが、確認なしでの確定を避けるため廃止した。
 *
 * 日報・KYのみ、この場で作成する(現場ごとの実績記録という性質上、既存の登録画面
 * 同様「送信した時点で保存され、その後の詳細画面で内容を直せる」形を踏襲する)。
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
  await logAction({ companyId: user.companyId, userId: user.id, action: `voiceEntry.classify:${intent}` });
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

  // 以下はいずれも、この場では何も登録せず、話した内容を引き継いだ状態で
  // 該当する登録画面(そこで内容を確認してから登録する)へ遷移するだけ。
  if (intent === "CUSTOMER") {
    redirect(`/customers/new?prefillTranscript=${encodeURIComponent(transcript)}`);
  }
  if (intent === "EMPLOYEE") {
    redirect(`/employees/new?prefillTranscript=${encodeURIComponent(transcript)}`);
  }
  if (intent === "PROJECT_REQUEST") {
    redirect(`/projects/new?prefillTranscript=${encodeURIComponent(transcript)}`);
  }
  if (intent === "ESTIMATE") {
    redirect(`/quotes/new?prefillTranscript=${encodeURIComponent(transcript)}`);
  }
  if (intent === "INVOICE") {
    redirect(`/invoices/new?voiceNote=${encodeURIComponent(transcript)}`);
  }
  if (intent === "CONSTRUCTION_PLAN") {
    redirect(`/construction-plans/new?voiceNote=${encodeURIComponent(transcript)}`);
  }

  // SAFETY_DOCUMENT・NEAR_MISSはまだ専用の登録画面が無く、OTHERはどれにも
  // 当てはまらなかった内容のため、AIが何かを勝手に作ることはせず、判定結果を
  // そのまま伝えて人に判断してもらう(架空の機能へ誘導しない)。
  if (intent === "SAFETY_DOCUMENT") {
    return {
      notice:
        "安全書類に関する内容のようです。この機能はまだ準備中のため自動では登録できません。話した内容は上の欄に残っていますので、コピーしてご利用ください。",
    };
  }
  if (intent === "NEAR_MISS") {
    return {
      notice:
        "ヒヤリハットの報告のようです。専用の登録画面はまだ準備中です。危険予知(KY)画面や日報の注意事項欄への記録をご検討ください。",
    };
  }
  return {
    notice:
      "内容をうまく判定できませんでした。日報・KY・見積・請求・施工計画・顧客登録・従業員登録・案件依頼のいずれかであれば、該当する画面から直接入力してください。",
  };
}
