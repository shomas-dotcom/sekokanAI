import type { Prisma } from "@/generated/prisma/client";
import type { LaborCategory } from "@/generated/prisma/enums";
import {
  jstWallTimeToUtc,
  computeAttendanceBreakdown,
  computeNightShiftMinutes,
  mergeWorkIntervals,
} from "@/lib/timesheet/time";
import { amountOf } from "@/lib/timesheet/siteAttendanceTotals";
import type { getOrCreateWorkSettings } from "@/lib/timesheet/settings";

// 日報の作業員明細を、勤怠・出面へ反映する処理(日報の画面の保存処理から呼ぶ)。
// もとは daily-reports/actions.ts の中にあったものを、かんたん入力の保存処理からも使えるように
// 取り出した(Server Actionのファイルからは非同期関数以外を公開できないため)。

export type WorkSettings = Awaited<ReturnType<typeof getOrCreateWorkSettings>>;
export type AuditEntry = { companyId: string; userId: string; action: string; targetType: string; targetId: string };

// 同じ日の日報どうしで作業時間が重なったとき、勤怠の備考に付ける印(合算せず確認を促す)。
export const OVERLAP_REMARK = "【要確認】同じ日の別の日報と作業時間が重なっています。時間を確認してください。";

// 承認前の出面だけ、日報の修正に合わせて直す(承認済み・締め済みは給与・請求の根拠なので変えない)。
export const SITE_ATTENDANCE_EDITABLE = ["DRAFT", "SUBMITTED", "REJECTED"];

/**
 * 労務原価の単価(1人工あたり・円)を引き当てる。従業員ごとの単価を優先し、なければ区分ごとの単価。
 * どちらも未登録なら null(0円にせず「単価未登録」として扱う)。
 */
export async function resolveLaborUnitPrice(
  db: Prisma.TransactionClient,
  companyId: string,
  target: { employeeId: string | null; laborCategory: LaborCategory | null }
): Promise<number | null> {
  if (target.employeeId) {
    const rate = await db.employeeLaborRate.findFirst({ where: { companyId, employeeId: target.employeeId } });
    if (rate) return rate.dailyUnitPrice;
  }
  if (target.laborCategory) {
    const rate = await db.laborCategoryRate.findFirst({ where: { companyId, category: target.laborCategory } });
    if (rate) return rate.dailyUnitPrice;
  }
  return null;
}

/**
 * 作業員明細を勤怠(自社従業員のみ・従業員×日付で1件)・出面(全種別、明細ごとに1件)へ反映する。
 * 反映先がすでに承認済み(APPROVED)・締め済み(CLOSED)の場合は上書きしない
 * (給与・請求の確定後に日報の修正で勝手に変わらないようにするため)。
 *
 * 作業員明細の作成と同じ保存単位(トランザクション)の中で呼ぶ。途中で失敗したら明細・勤怠・出面の
 * すべてが保存されない(一部だけ保存されて再送で重複する、を防ぐ。調査報告F08)。
 * 操作ログは保存確定後に書くため、書くべき内容を戻り値で返す。
 */
export async function reflectDailyReportWorker(
  db: Prisma.TransactionClient,
  workerId: string,
  actor: { id: string; companyId: string },
  settings: WorkSettings
): Promise<AuditEntry[]> {
  const audit: AuditEntry[] = [];
  const worker = await db.dailyReportWorker.findUnique({
    where: { id: workerId },
    include: { dailyReport: true },
  });
  if (!worker) return audit;

  const clockIn = worker.startTime ? jstWallTimeToUtc(worker.dailyReport.reportDate, worker.startTime) : null;
  const clockOut = worker.endTime ? jstWallTimeToUtc(worker.dailyReport.reportDate, worker.endTime) : null;

  if (worker.reflectToAttendance && worker.employeeId) {
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

    const existing = await db.attendance.findUnique({
      where: { employeeId_targetDate: { employeeId: worker.employeeId, targetDate: worker.dailyReport.reportDate } },
    });
    if (!existing) {
      const created = await db.attendance.create({
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
      await db.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: created.id } });
      audit.push({
        companyId: actor.companyId,
        userId: actor.id,
        action: "attendance.create",
        targetType: "Attendance",
        targetId: created.id,
      });
    } else if (existing.status === "DRAFT" || existing.status === "REJECTED") {
      // 同じ人が同じ日に別の現場の日報にも出ている場合、その分とまとめて1日分を計算し直す
      // (以前は後から反映した現場の時間で上書きしており、3時間+4時間が4時間になっていた)。
      const alreadyLinked = await db.dailyReportWorker.findMany({
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
        await db.attendance.update({
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

        await db.attendance.update({
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
      await db.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: existing.id } });
      audit.push({
        companyId: actor.companyId,
        userId: actor.id,
        action: "attendance.update",
        targetType: "Attendance",
        targetId: existing.id,
      });
    } else {
      // 承認済み・締め済み: 上書きしない。表示用にリンクだけ張る(画面側で「反映済み(承認済み)」等と示す)
      await db.dailyReportWorker.update({ where: { id: worker.id }, data: { attendanceId: existing.id } });
    }
  }

  if (worker.reflectToSiteAttendance) {
    // 人数が2名以上のまとめ入力(外注・応援等)は、出面1件に「人数×1人あたりの人工数」の合計を入れる。
    const totalManDays = (worker.manDays ?? 1) * worker.headcount;
    // 管理者が労務単価を登録している場合だけ、労務原価の単価・金額を自動で入れる。
    // 未登録なら従来どおり未入力のまま(0円にしない。管理者が出面の画面で入力する)。
    const registeredPrice = await resolveLaborUnitPrice(db, actor.companyId, worker);

    const linked = worker.siteAttendanceId
      ? await db.siteAttendance.findUnique({ where: { id: worker.siteAttendanceId } })
      : null;

    if (linked) {
      // すでに反映済みの出面(日報を直して保存し直したとき)。承認前なら内容を直し、二重に作らない。
      if (SITE_ATTENDANCE_EDITABLE.includes(linked.status)) {
        // 管理者が出面の画面で手入力した原価単価があれば、それを優先して残す。
        const unitPrice = linked.laborCostUnitPrice ?? registeredPrice;
        await db.siteAttendance.update({
          where: { id: linked.id },
          data: {
            targetDate: worker.dailyReport.reportDate,
            workerName: worker.workerName,
            jobType: worker.role,
            workContent: worker.workDescription,
            startTime: clockIn,
            endTime: clockOut,
            breakMinutes: worker.breakMinutes ?? 0,
            workMinutes: worker.workMinutes,
            manDays: totalManDays,
            amount: amountOf(totalManDays, linked.manDayUnitPrice),
            laborCostUnitPrice: unitPrice,
            laborCostAmount: amountOf(totalManDays, unitPrice),
            isBillable: worker.isBillable,
            updatedByUserId: actor.id,
          },
        });
        audit.push({
          companyId: actor.companyId,
          userId: actor.id,
          action: "laborEntry.update",
          targetType: "SiteAttendance",
          targetId: linked.id,
        });
      }
      return audit;
    }

    // 出面には勤怠のような「本人が見直して提出する」自己申告画面がなく、日報を保存した
    // 時点で内容は確認済みとみなせるため、下書きを経由せず提出済みとして作成する
    // (管理者がsite-attendance画面で承認・差し戻しを行う)。
    const created = await db.siteAttendance.create({
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
        manDays: totalManDays,
        isBillable: worker.isBillable,
        ...(registeredPrice != null
          ? { laborCostUnitPrice: registeredPrice, laborCostAmount: amountOf(totalManDays, registeredPrice) }
          : {}),
        status: "SUBMITTED",
        submittedAt: new Date(),
        createdByUserId: actor.id,
      },
    });
    await db.dailyReportWorker.update({ where: { id: worker.id }, data: { siteAttendanceId: created.id } });
    audit.push({
      companyId: actor.companyId,
      userId: actor.id,
      action: "laborEntry.create",
      targetType: "SiteAttendance",
      targetId: created.id,
    });
  }

  return audit;
}
