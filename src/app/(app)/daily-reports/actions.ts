"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { draftDailyReportFromText } from "@/lib/ai";
import {
  jstWallTimeToUtc,
  computeWorkMinutes,
  computeAttendanceBreakdown,
  computeNightShiftMinutes,
  mergeWorkIntervals,
} from "@/lib/timesheet/time";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import type { DailyReportWorkerType } from "@/generated/prisma/enums";

export type DailyReportFormState = { error?: string } | undefined;

export async function createDailyReportAction(
  _prevState: DailyReportFormState,
  formData: FormData
): Promise<DailyReportFormState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const reportDateStr = String(formData.get("reportDate") ?? "");
  const rawVoiceInput = String(formData.get("rawVoiceInput") ?? "").trim();

  // GPS・天気自動取得ボタン(LocationWeatherButton)が埋める隠しフィールド。
  // 取得できなかった場合は空文字のままなので、その場合はnullとして扱う。
  const latitudeStr = String(formData.get("latitude") ?? "").trim();
  const longitudeStr = String(formData.get("longitude") ?? "").trim();
  const capturedAddress = String(formData.get("capturedAddress") ?? "").trim() || null;
  const weatherAuto = String(formData.get("weatherAuto") ?? "").trim() || null;

  if (!projectId) return { error: "案件を選択してください。" };
  if (!reportDateStr) return { error: "日付を入力してください。" };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
  });
  if (!project) return { error: "案件が見つかりません。" };

  const draft = rawVoiceInput
    ? await draftDailyReportFromText(rawVoiceInput, {
        companyId: user.companyId,
        userId: user.id,
        feature: "dailyReport.draft",
      })
    : null;

  const report = await prisma.dailyReport.create({
    data: {
      companyId: user.companyId,
      projectId,
      reportDate: new Date(reportDateStr),
      // 現在地から取得した天気があればそれを優先し、なければ音声からの推定を使う
      weather: weatherAuto ?? draft?.weather ?? null,
      workerCount: draft?.workerCount ?? null,
      workContent: draft?.workContent ?? null,
      machinery: draft?.machinery ?? null,
      quantityWorked: draft?.quantityWorked ?? null,
      safetyNotes: draft?.safetyNotes ?? null,
      nextDayPlan: draft?.nextDayPlan ?? null,
      foremanName: draft?.foremanName ?? null,
      vehicles: draft?.vehicles ?? null,
      startTime: draft?.startTime ?? null,
      endTime: draft?.endTime ?? null,
      dangerPrediction: draft?.dangerPrediction ?? null,
      latitude: latitudeStr ? Number(latitudeStr) : null,
      longitude: longitudeStr ? Number(longitudeStr) : null,
      capturedAddress,
      rawVoiceInput: rawVoiceInput || null,
      unclearItemsJson: draft ? JSON.stringify(draft.unclearItems) : null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.create",
    targetType: "DailyReport",
    targetId: report.id,
  });

  revalidatePath("/daily-reports");
  redirect(`/daily-reports/${report.id}`);
}

export async function updateDailyReportAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!report) redirect("/daily-reports");

  const workerCountStr = String(formData.get("workerCount") ?? "").trim();
  const breakMinutesStr = String(formData.get("breakMinutes") ?? "").trim();
  const overtimeMinutesStr = String(formData.get("overtimeMinutes") ?? "").trim();

  await prisma.dailyReport.update({
    where: { id },
    data: {
      weather: String(formData.get("weather") ?? "").trim() || null,
      workerCount: workerCountStr ? Number(workerCountStr) : null,
      workContent: String(formData.get("workContent") ?? "").trim() || null,
      machinery: String(formData.get("machinery") ?? "").trim() || null,
      quantityWorked: String(formData.get("quantityWorked") ?? "").trim() || null,
      safetyNotes: String(formData.get("safetyNotes") ?? "").trim() || null,
      issues: String(formData.get("issues") ?? "").trim() || null,
      nextDayPlan: String(formData.get("nextDayPlan") ?? "").trim() || null,
      foremanName: String(formData.get("foremanName") ?? "").trim() || null,
      vehicles: String(formData.get("vehicles") ?? "").trim() || null,
      materials: String(formData.get("materials") ?? "").trim() || null,
      subcontractors: String(formData.get("subcontractors") ?? "").trim() || null,
      startTime: String(formData.get("startTime") ?? "").trim() || null,
      endTime: String(formData.get("endTime") ?? "").trim() || null,
      breakMinutes: breakMinutesStr ? Number(breakMinutesStr) : null,
      overtimeMinutes: overtimeMinutesStr ? Number(overtimeMinutesStr) : null,
      dangerPrediction: String(formData.get("dangerPrediction") ?? "").trim() || null,
      remarks: String(formData.get("remarks") ?? "").trim() || null,
      capturedAddress: String(formData.get("capturedAddress") ?? "").trim() || null,
      // 人間が内容を確認・保存した時点で確認候補は解消したとみなす
      unclearItemsJson: null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.update",
    targetType: "DailyReport",
    targetId: id,
  });

  revalidatePath(`/daily-reports/${id}`);
  redirect(`/daily-reports/${id}`);
}

export async function deleteDailyReportAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  await prisma.dailyReport.deleteMany({ where: { id, companyId: user.companyId } });
  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "dailyReport.delete",
    targetType: "DailyReport",
    targetId: id,
  });

  revalidatePath("/daily-reports");
  redirect("/daily-reports");
}

const WORKER_TYPES: DailyReportWorkerType[] = ["EMPLOYEE", "PARTNER", "SUBCONTRACTOR", "MANUAL"];

// 同じ日の日報どうしで作業時間が重なったとき、勤怠の備考に付ける印(合算せず確認を促す)。
const OVERLAP_REMARK = "【要確認】同じ日の別の日報と作業時間が重なっています。時間を確認してください。";

/**
 * 日報の作業員明細を追加する(自社従業員はマスタから選択、協力会社・外注・手入力は
 * 直接入力)。既存の「作業員数」「職長」は削除せず、明細からここで自動計算して同期する
 * (過去の日報表示は変えない。明細が1件もない日報は従来どおりの値のまま)。
 */
export async function addDailyReportWorkerAction(formData: FormData) {
  const user = await requireUser();
  const dailyReportId = String(formData.get("dailyReportId") ?? "");

  const report = await prisma.dailyReport.findFirst({ where: { id: dailyReportId, companyId: user.companyId } });
  if (!report) redirect("/daily-reports");

  const workerTypeRaw = String(formData.get("workerType") ?? "EMPLOYEE");
  const workerType: DailyReportWorkerType = WORKER_TYPES.includes(workerTypeRaw as DailyReportWorkerType)
    ? (workerTypeRaw as DailyReportWorkerType)
    : "EMPLOYEE";
  const employeeIdRaw = String(formData.get("employeeId") ?? "").trim() || null;
  const manualName = String(formData.get("workerName") ?? "").trim();

  let employeeId: string | null = null;
  let workerName: string;
  if (workerType === "EMPLOYEE" && employeeIdRaw) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeIdRaw, companyId: user.companyId } });
    if (!employee) {
      revalidatePath(`/daily-reports/${dailyReportId}`);
      return;
    }
    employeeId = employee.id;
    workerName = employee.name;
  } else {
    if (!manualName) {
      revalidatePath(`/daily-reports/${dailyReportId}`);
      return;
    }
    workerName = manualName;
  }

  const role = String(formData.get("role") ?? "").trim() || null;
  const startTime = String(formData.get("startTime") ?? "").trim() || null;
  const endTime = String(formData.get("endTime") ?? "").trim() || null;
  const breakMinutesStr = String(formData.get("breakMinutes") ?? "").trim();
  const breakMinutes = breakMinutesStr ? Number(breakMinutesStr) : 0;
  // 負の休憩・小数・数字以外は受け付けない(実働が水増しされるのを防ぐ)。
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    revalidatePath(`/daily-reports/${dailyReportId}`);
    return;
  }
  const manDaysStr = String(formData.get("manDays") ?? "").trim();
  const workDescription = String(formData.get("workDescription") ?? "").trim() || null;
  const isForeman = formData.get("isForeman") === "on";
  const isBillable = formData.get("isBillable") === "on";
  const reflectToAttendance = formData.get("reflectToAttendance") === "on";
  const reflectToSiteAttendance = formData.get("reflectToSiteAttendance") === "on";
  const workMinutes = computeWorkMinutes(startTime, endTime, breakMinutes);
  const sortOrder = await prisma.dailyReportWorker.count({ where: { dailyReportId } });

  const worker = await prisma.$transaction(async (tx) => {
    if (isForeman) {
      await tx.dailyReportWorker.updateMany({ where: { dailyReportId }, data: { isForeman: false } });
    }
    return tx.dailyReportWorker.create({
      data: {
        companyId: user.companyId,
        dailyReportId,
        employeeId,
        workerName,
        workerType,
        role,
        startTime,
        endTime,
        breakMinutes,
        workMinutes,
        manDays: manDaysStr ? Number(manDaysStr) : null,
        workDescription,
        isBillable,
        isForeman,
        reflectToAttendance,
        reflectToSiteAttendance,
        sortOrder,
      },
    });
  });

  // 作業員数・職長を既存項目(互換表示用)へ同期する
  const workerCount = await prisma.dailyReportWorker.count({ where: { dailyReportId } });
  const foreman = await prisma.dailyReportWorker.findFirst({ where: { dailyReportId, isForeman: true } });
  await prisma.dailyReport.update({
    where: { id: dailyReportId },
    data: { workerCount, foremanName: foreman?.workerName ?? report.foremanName },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    action: "laborEntry.create",
    targetType: "DailyReportWorker",
    targetId: worker.id,
  });

  await reflectDailyReportWorker(worker.id, { id: user.id, companyId: user.companyId });

  revalidatePath(`/daily-reports/${dailyReportId}`);
}

export async function deleteDailyReportWorkerAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const dailyReportId = String(formData.get("dailyReportId") ?? "");

  const report = await prisma.dailyReport.findFirst({ where: { id: dailyReportId, companyId: user.companyId } });
  if (!report) redirect("/daily-reports");

  await prisma.dailyReportWorker.deleteMany({ where: { id, dailyReportId } });

  const workerCount = await prisma.dailyReportWorker.count({ where: { dailyReportId } });
  const foreman = await prisma.dailyReportWorker.findFirst({ where: { dailyReportId, isForeman: true } });
  await prisma.dailyReport.update({
    where: { id: dailyReportId },
    data: workerCount > 0 ? { workerCount, foremanName: foreman?.workerName ?? null } : {},
  });

  revalidatePath(`/daily-reports/${dailyReportId}`);
}

/**
 * 作業員明細を勤怠(自社従業員のみ・従業員×日付で1件)・出面(全種別、明細ごとに1件)へ反映する。
 * 反映先がすでに承認済み(APPROVED)・締め済み(CLOSED)の場合は上書きしない
 * (給与・請求の確定後に日報の修正で勝手に変わらないようにするため)。
 */
async function reflectDailyReportWorker(workerId: string, actor: { id: string; companyId: string }) {
  const worker = await prisma.dailyReportWorker.findUnique({
    where: { id: workerId },
    include: { dailyReport: true },
  });
  if (!worker) return;

  const clockIn = worker.startTime ? jstWallTimeToUtc(worker.dailyReport.reportDate, worker.startTime) : null;
  const clockOut = worker.endTime ? jstWallTimeToUtc(worker.dailyReport.reportDate, worker.endTime) : null;

  if (worker.reflectToAttendance && worker.employeeId) {
    const settings = await getOrCreateWorkSettings(actor.companyId);
    // 日報からの反映では休日出勤・有給等の区分までは分からないため、いったん通常勤務として
    // 普通/残業時間を計算する(区分の修正は勤怠の確認・承認画面で行う想定)。
    const breakdown = computeAttendanceBreakdown({
      actualWorkMinutes: worker.workMinutes,
      workCategory: "NORMAL",
      scheduledWorkMinutes: settings.scheduledWorkMinutes,
    });
    const nightShiftMinutes = computeNightShiftMinutes(
      clockIn,
      clockOut,
      settings.nightShiftStartTime,
      settings.nightShiftEndTime
    );

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_targetDate: { employeeId: worker.employeeId, targetDate: worker.dailyReport.reportDate } },
    });
    if (!existing) {
      const created = await prisma.attendance.create({
        data: {
          companyId: actor.companyId,
          employeeId: worker.employeeId,
          targetDate: worker.dailyReport.reportDate,
          sourceDailyReportId: worker.dailyReportId,
          clockInTime: clockIn,
          clockOutTime: clockOut,
          siteArrivalTime: clockIn,
          siteDepartureTime: clockOut,
          breakMinutes: worker.breakMinutes ?? 0,
          actualWorkMinutes: worker.workMinutes,
          normalWorkMinutes: breakdown.normalWorkMinutes,
          overtimeMinutes: breakdown.overtimeMinutes,
          nightShiftMinutes,
          createdByUserId: actor.id,
        },
      });
      await prisma.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: created.id } });
      await logAction({
        companyId: actor.companyId,
        userId: actor.id,
        action: "attendance.create",
        targetType: "Attendance",
        targetId: created.id,
      });
    } else if (existing.status === "DRAFT" || existing.status === "REJECTED") {
      // 同じ人が同じ日に別の現場の日報にも出ている場合、その分とまとめて1日分を計算し直す
      // (以前は後から反映した現場の時間で上書きしており、3時間+4時間が4時間になっていた)。
      const alreadyLinked = await prisma.dailyReportWorker.findMany({
        where: { attendanceId: existing.id, reflectToAttendance: true, id: { not: worker.id } },
        include: { dailyReport: { select: { reportDate: true } } },
      });
      const sameDayWorkers = [...alreadyLinked, worker];
      const intervals = sameDayWorkers.map((w) => ({
        start: w.startTime ? jstWallTimeToUtc(w.dailyReport.reportDate, w.startTime) : null,
        end: w.endTime ? jstWallTimeToUtc(w.dailyReport.reportDate, w.endTime) : null,
        breakMinutes: w.breakMinutes ?? 0,
        workMinutes: w.workMinutes,
      }));
      const merged = mergeWorkIntervals(intervals);

      if (merged.overlaps) {
        // 時間帯が重なる = 二重登録か入力誤りのおそれ。合算も上書きもせず、備考で確認を促す
        // (勤怠は下書きのまま残り、本人・管理者が確認画面で直す)。
        const remarks = existing.remarks?.includes(OVERLAP_REMARK)
          ? existing.remarks
          : [OVERLAP_REMARK, existing.remarks].filter(Boolean).join("\n");
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { remarks, updatedByUserId: actor.id },
        });
      } else {
        const mergedBreakdown = computeAttendanceBreakdown({
          actualWorkMinutes: merged.workMinutes,
          workCategory: "NORMAL",
          scheduledWorkMinutes: settings.scheduledWorkMinutes,
        });
        const nightPerInterval = intervals.map((i) =>
          computeNightShiftMinutes(i.start, i.end, settings.nightShiftStartTime, settings.nightShiftEndTime)
        );
        const mergedNight = nightPerInterval.every((n) => n == null)
          ? null
          : nightPerInterval.reduce<number>((sum, n) => sum + (n ?? 0), 0);

        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            sourceDailyReportId: worker.dailyReportId,
            clockInTime: merged.clockIn ?? existing.clockInTime,
            clockOutTime: merged.clockOut ?? existing.clockOutTime,
            normalWorkMinutes: mergedBreakdown.normalWorkMinutes ?? existing.normalWorkMinutes,
            overtimeMinutes: mergedBreakdown.overtimeMinutes ?? existing.overtimeMinutes,
            nightShiftMinutes: mergedNight ?? existing.nightShiftMinutes,
            siteArrivalTime: merged.clockIn ?? existing.siteArrivalTime,
            siteDepartureTime: merged.clockOut ?? existing.siteDepartureTime,
            breakMinutes: merged.breakMinutes,
            actualWorkMinutes: merged.workMinutes ?? existing.actualWorkMinutes,
            updatedByUserId: actor.id,
          },
        });
      }
      await prisma.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: existing.id } });
      await logAction({
        companyId: actor.companyId,
        userId: actor.id,
        action: "attendance.update",
        targetType: "Attendance",
        targetId: existing.id,
      });
    } else {
      // 承認済み・締め済み: 上書きしない。表示用にリンクだけ張る(画面側で「反映済み(承認済み)」等と示す)
      await prisma.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: existing.id } });
    }
  }

  if (worker.reflectToSiteAttendance) {
    // 出面には勤怠のような「本人が見直して提出する」自己申告画面がなく、日報を保存した
    // 時点で内容は確認済みとみなせるため、下書きを経由せず提出済みとして作成する
    // (管理者がsite-attendance画面で承認・差し戻しを行う)。
    const created = await prisma.siteAttendance.create({
      data: {
        companyId: actor.companyId,
        targetDate: worker.dailyReport.reportDate,
        projectId: worker.dailyReport.projectId,
        sourceDailyReportId: worker.dailyReportId,
        employeeId: worker.employeeId,
        workerName: worker.workerName,
        jobType: worker.role,
        workContent: worker.workDescription,
        startTime: clockIn,
        endTime: clockOut,
        breakMinutes: worker.breakMinutes ?? 0,
        workMinutes: worker.workMinutes,
        manDays: worker.manDays ?? 1,
        isBillable: worker.isBillable,
        status: "SUBMITTED",
        submittedAt: new Date(),
        createdByUserId: actor.id,
      },
    });
    await prisma.dailyReportWorker.update({ where: { id: worker.id }, data: { siteAttendanceId: created.id } });
    await logAction({
      companyId: actor.companyId,
      userId: actor.id,
      action: "laborEntry.create",
      targetType: "SiteAttendance",
      targetId: created.id,
    });
  }
}
