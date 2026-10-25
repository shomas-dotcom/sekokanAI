"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import { draftDailyReportFromText } from "@/lib/ai";
import { parseReportDateInput } from "@/lib/dailyReport/dateInput";
import { ensureDailyReportMasters, parseMeasures, MASTER_ORDER } from "@/lib/dailyReport/masters";
import { mergeExtraction, parseQuickPayload, type QuickState } from "@/lib/dailyReport/quickInput";
import { extractQuickEntries } from "@/lib/dailyReport/quickExtractAi";
import { QuickSaveError, saveQuickReport } from "@/lib/dailyReport/saveQuick";

// 日報かんたん入力(4タブ)の画面から呼ばれる処理。
// 保存の中身は src/lib/dailyReport/saveQuick.ts(トランザクション内でまとめて行う)。

export type QuickSaveState = { error?: string } | undefined;

function readNumber(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export async function saveQuickDailyReportAction(
  _prevState: QuickSaveState,
  formData: FormData
): Promise<QuickSaveState> {
  const user = await requireUser();
  const reportId = String(formData.get("id") ?? "").trim() || null;
  const projectId = String(formData.get("projectId") ?? "").trim();

  const reportDate = parseReportDateInput(String(formData.get("reportDate") ?? "").trim());
  if (!reportDate) return { error: "日付を入力してください。" };
  if (!reportId && !projectId) return { error: "案件を選択してください。" };

  const parsed = parseQuickPayload(String(formData.get("payload") ?? ""));
  if (!parsed.ok) return { error: parsed.error };

  // 現場責任者は、担当している現場の日報だけ直せる(日報の詳細画面と同じ決まり)。
  if (reportId && user.role === "SITE_MANAGER") {
    const report = await prisma.dailyReport.findFirst({
      where: { id: reportId, companyId: user.companyId },
      select: { projectId: true },
    });
    const supervises = report
      ? await prisma.projectSupervisor.findFirst({ where: { projectId: report.projectId, userId: user.id } })
      : null;
    if (!supervises) return { error: "この日報を修正する権限がありません。" };
  }

  const weatherAuto = String(formData.get("weatherAuto") ?? "").trim();
  const weather = weatherAuto || String(formData.get("weather") ?? "").trim() || null;
  const nextDayPlan = String(formData.get("nextDayPlan") ?? "").trim() || null;
  const settings = await getOrCreateWorkSettings(user.companyId);
  const memo = String(formData.get("memo") ?? "").trim();

  // 新規作成で話した内容があるときは、従来の音声入力と同じように、開始/終了時間・安全確認・職長・天候も
  // 読み取る(AIが使えない環境では言葉のルールで読み取る。読み取れなかった項目は空欄のまま)。
  // 時間のかかるAI呼び出しは、データベースの保存単位(トランザクション)の外で先に済ませる。
  let voiceDraft: Awaited<ReturnType<typeof draftDailyReportFromText>> | null = null;
  if (!reportId && memo) {
    try {
      voiceDraft = await draftDailyReportFromText(memo, {
        companyId: user.companyId,
        userId: user.id,
        feature: "dailyReport.draft",
      });
    } catch (err) {
      console.error("[saveQuickDailyReportAction] voice draft failed (continuing without it)", err);
    }
  }

  let result: Awaited<ReturnType<typeof saveQuickReport>>;
  try {
    result = await prisma.$transaction(
      (tx) =>
        saveQuickReport(tx, {
          actor: { id: user.id, companyId: user.companyId, role: user.role },
          settings,
          reportId,
          projectId,
          reportDate,
          weather,
          gps: {
            latitude: readNumber(formData.get("latitude")),
            longitude: readNumber(formData.get("longitude")),
            capturedAddress: String(formData.get("capturedAddress") ?? "").trim() || null,
          },
          memo,
          nextDayPlan,
          state: parsed.state,
          voiceDraft: voiceDraft && {
            weather: voiceDraft.weather,
            startTime: voiceDraft.startTime,
            endTime: voiceDraft.endTime,
            safetyNotes: voiceDraft.safetyNotes,
            foremanName: voiceDraft.foremanName,
          },
        }),
      // 無料のデータベースは応答が遅いことがあるため、明細が多い日報でも途中で切れないよう長めに待つ。
      { timeout: 45_000, maxWait: 10_000 }
    );
  } catch (err) {
    if (err instanceof QuickSaveError) return { error: err.message };
    console.error("[saveQuickDailyReportAction] failed", err);
    return { error: "保存できませんでした。通信状態を確認して、もう一度お試しください。入力した内容は画面に残っています。" };
  }

  for (const entry of result.audit) {
    await logAction({
      companyId: entry.companyId,
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
    });
  }

  revalidatePath("/daily-reports");
  revalidatePath(`/daily-reports/${result.reportId}`);
  revalidatePath("/site-attendance");
  const params = new URLSearchParams({ saved: "1" });
  if (result.warnings.length > 0) params.set("notice", result.warnings.join("\n").slice(0, 800));
  redirect(`/daily-reports/${result.reportId}?${params.toString()}`);
}

export type QuickVoiceState = {
  error?: string;
  state?: QuickState;
  /** 今回の音声から取り出した翌日の予定(欄が空のときだけ画面で使う)。 */
  nextDayPlan?: string | null;
  added?: string[];
  skipped?: string[];
  unclear?: string[];
};

let keyCounter = 0;
const serverKey = () => `v${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

/**
 * 音声(または文章)の内容から、作業内容・数量・機械・人数・危険・翌日の予定を取り出して、
 * いま選んである内容へ重ねる。DBには何も書かない(画面に仮入力するだけ。保存は人が押す)。
 * 同じ機械・作業は二重に入れない。機械の金額や単価はここでは決めない。
 */
export async function analyzeQuickVoiceAction(text: string, currentStateJson: string): Promise<QuickVoiceState> {
  const user = await requireUser();
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { error: "音声または文章を入力してから押してください。" };
  if (trimmed.length > 5000) return { error: "文章が長すぎます(5000文字まで)。" };

  const current = parseQuickPayload(currentStateJson);
  if (!current.ok) return { error: current.error };

  await ensureDailyReportMasters(user.companyId);
  const companyId = user.companyId;
  const [works, machines, hazards] = await Promise.all([
    prisma.workItemMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
    prisma.machineMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
    prisma.kyHazardMaster.findMany({ where: { companyId, isActive: true }, orderBy: MASTER_ORDER }),
  ]);

  const extraction = await extractQuickEntries(
    trimmed,
    {
      works: works.map((w) => ({ id: w.id, label: w.label })),
      machines: machines.map((m) => ({ id: m.id, name: m.name })),
      hazards: hazards.map((h) => ({ id: h.id, label: h.label, measures: parseMeasures(h.measuresJson) })),
    },
    { companyId, userId: user.id, feature: "dailyReport.quickVoice" }
  );

  const merged = mergeExtraction(current.state, extraction, serverKey);
  return {
    state: merged.state,
    nextDayPlan: extraction.nextDayPlan,
    added: merged.added,
    skipped: merged.skipped,
    unclear: extraction.unclear,
  };
}
