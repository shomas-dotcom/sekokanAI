import type { Prisma } from "@/generated/prisma/client";
import type { DailyReportWorkerType } from "@/generated/prisma/enums";
import { changeDailyReportDate } from "./changeDate";
import {
  derivedWorkerName,
  hasOperatorDoubleCount,
  machineAmount,
  summarizeKy,
  summarizeMachinery,
  summarizeQuantities,
  summarizeVehicles,
  summarizeWorks,
  type QuickState,
} from "./quickInput";
import { LABOR_CATEGORY_LABEL } from "./standardMasters";
import {
  reflectDailyReportWorker,
  removeMachineUsageWithExpense,
  removeWorkerWithDerived,
  resolveLaborUnitPrice,
  type AuditEntry,
  type WorkSettings,
} from "./reflectWorker";

// 日報かんたん入力(4タブ)の保存。新規作成も、前回の日報の修正(日付の変更を含む)も同じ処理で行う。
// すべて1つのトランザクションの中で呼ぶこと(途中で失敗したら全部取り消され、半端な状態が残らない)。
//
// 方針:
// - 機械の金額・労務の単価は画面から受け取らない。会社のマスタの単価からここで計算する。
// - 日報の既存の文章欄(作業内容・使用機械・危険予知など)にも要約を書く(PDF・Excel・既存画面を壊さないため)。
//   ただし、かんたん入力を使っていない古い日報の文章は、その項目を選び直すまで消さない。
// - 勤怠・出面・機械の経費は、承認前のものだけ日報の修正に合わせて直す(承認後は変えない)。

/** 利用者にそのまま見せてよい日本語のエラー。 */
export class QuickSaveError extends Error {}

export type QuickSaveInput = {
  actor: { id: string; companyId: string; role: string };
  settings: WorkSettings;
  /** 修正のときは日報のID。新規作成ならnull。 */
  reportId: string | null;
  /** 新規作成のときの案件。修正のときは日報の案件のまま(変えられない)。 */
  projectId: string;
  reportDate: Date;
  weather: string | null;
  gps: { latitude: number | null; longitude: number | null; capturedAddress: string | null } | null;
  /** 音声認識結果・メモ(自由記入)。 */
  memo: string;
  nextDayPlan: string | null;
  state: QuickState;
  /**
   * 新規作成のときだけ使う、話した内容から読み取った開始/終了時間・安全確認・職長・天候
   * (従来の音声入力と同じ項目)。人が入力した天候があればそちらを優先し、空欄のものだけ補う。
   */
  voiceDraft?: {
    weather: string | null;
    startTime: string | null;
    endTime: string | null;
    safetyNotes: string | null;
    foremanName: string | null;
  } | null;
};

export type QuickSaveResult = {
  reportId: string;
  created: boolean;
  /** 保存はできたが、利用者に伝えておくこと(日付が変えられなかった、1人工を超えている等)。 */
  warnings: string[];
  audit: AuditEntry[];
};

const WORKER_TYPE_BY_CATEGORY: Record<string, DailyReportWorkerType> = {
  SUBCONTRACT_WORKER: "SUBCONTRACTOR",
  SUPPORT_WORKER: "PARTNER",
};

export async function saveQuickReport(db: Prisma.TransactionClient, input: QuickSaveInput): Promise<QuickSaveResult> {
  const { actor, settings, state } = input;
  const companyId = actor.companyId;
  const warnings: string[] = [];
  const audit: AuditEntry[] = [];

  // --- 1. 日報と案件(会社が違うものは見つからない扱いにする) ---
  const existing = input.reportId
    ? await db.dailyReport.findFirst({
        where: { id: input.reportId, companyId },
        include: {
          workers: { include: { attendance: true, siteAttendance: true } },
          workEntries: { select: { id: true } },
          kyEntries: { select: { id: true } },
          machineUsages: { include: { siteExpenseEntry: true } },
        },
      })
    : null;
  if (input.reportId && !existing) throw new QuickSaveError("日報が見つかりません。");

  const projectId = existing ? existing.projectId : input.projectId;
  const project = await db.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } });
  if (!project) throw new QuickSaveError("案件が見つかりません。");

  // --- 2. 選んだ内容が、すべてこの会社のマスタ・従業員のものか確認する ---
  const ids = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))];
  const [workMasters, machineMasters, hazardMasters, employees] = await Promise.all([
    db.workItemMaster.findMany({ where: { companyId, id: { in: ids(state.works.map((w) => w.workItemId)) } }, select: { id: true } }),
    db.machineMaster.findMany({ where: { companyId, id: { in: ids(state.machines.map((m) => m.machineId)) } } }),
    db.kyHazardMaster.findMany({ where: { companyId, id: { in: ids(state.ky.map((k) => k.hazardId)) } }, select: { id: true } }),
    db.employee.findMany({ where: { companyId, id: { in: ids(state.labor.map((l) => l.employeeId)) } }, select: { id: true, name: true } }),
  ]);
  const workIds = new Set(workMasters.map((m) => m.id));
  const machineById = new Map(machineMasters.map((m) => [m.id, m]));
  const hazardIds = new Set(hazardMasters.map((m) => m.id));
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  for (const l of state.labor) {
    if (l.employeeId && !employeeById.has(l.employeeId)) throw new QuickSaveError("選んだ従業員が見つかりません。");
  }

  // --- 3. 日報本体(既存の文章欄にも要約を書く) ---
  const hadWorks = (existing?.workEntries.length ?? 0) > 0;
  const hadMachines = (existing?.machineUsages.length ?? 0) > 0;
  const hadKy = (existing?.kyEntries.length ?? 0) > 0;
  const hadWorkers = (existing?.workers.length ?? 0) > 0;

  const summary: Prisma.DailyReportUncheckedUpdateInput = {};
  if (state.works.length > 0) {
    summary.workContent = summarizeWorks(state.works);
    summary.quantityWorked = summarizeQuantities(state.works) || null;
  } else if (!existing || hadWorks) {
    summary.workContent = input.memo || null;
    if (hadWorks) summary.quantityWorked = null;
  }
  if (state.machines.length > 0 || hadMachines) {
    summary.machinery = summarizeMachinery(state.machines) || null;
    summary.vehicles = summarizeVehicles(state.machines) || null;
  }
  if (state.ky.length > 0 || hadKy) summary.dangerPrediction = summarizeKy(state.ky) || null;

  const fields: Prisma.DailyReportUncheckedUpdateInput = {
    weather: input.weather,
    nextDayPlan: input.nextDayPlan,
    rawVoiceInput: input.memo || null,
    // 人が内容を確認して保存した時点で、音声から読み取れなかった項目の確認候補は解消したとみなす。
    unclearItemsJson: null,
    ...(input.gps?.latitude != null ? { latitude: input.gps.latitude } : {}),
    ...(input.gps?.longitude != null ? { longitude: input.gps.longitude } : {}),
    ...(input.gps?.capturedAddress ? { capturedAddress: input.gps.capturedAddress } : {}),
    ...summary,
  };

  let reportId: string;
  let effectiveDate = input.reportDate;
  if (existing) {
    reportId = existing.id;
    await db.dailyReport.update({ where: { id: reportId }, data: fields });
    effectiveDate = existing.reportDate;
    if (existing.reportDate.getTime() !== input.reportDate.getTime()) {
      // 日付の変更。動かせないものがあれば日付だけ変えず、他の内容は保存して理由を伝える。
      const moved = await changeDailyReportDate(db, { dailyReportId: reportId, companyId, newDate: input.reportDate });
      if (moved.ok) {
        effectiveDate = input.reportDate;
        audit.push({ companyId, userId: actor.id, action: "dailyReport.changeDate", targetType: "DailyReport", targetId: reportId });
      } else {
        warnings.push(`日付は変更できませんでした。${moved.error}`);
      }
    }
  } else {
    const draft = input.voiceDraft;
    const created = await db.dailyReport.create({
      data: {
        companyId,
        projectId,
        reportDate: input.reportDate,
        ...(fields as Omit<Prisma.DailyReportUncheckedCreateInput, "companyId" | "projectId" | "reportDate">),
        // 話した内容から読み取れた項目だけを補う(読み取れなかった項目は、推測せず空欄のまま)。
        weather: input.weather ?? draft?.weather ?? null,
        startTime: draft?.startTime ?? null,
        endTime: draft?.endTime ?? null,
        safetyNotes: draft?.safetyNotes ?? null,
        foremanName: draft?.foremanName ?? null,
      },
    });
    reportId = created.id;
  }

  // --- 4. 作業内容・危険予知(KY): 選び直した内容にまるごと置き換える(他の表とのつながりがないため) ---
  await db.dailyReportWorkEntry.deleteMany({ where: { dailyReportId: reportId } });
  if (state.works.length > 0) {
    await db.dailyReportWorkEntry.createMany({
      data: state.works.map((w, i) => ({
        dailyReportId: reportId,
        workItemId: w.workItemId && workIds.has(w.workItemId) ? w.workItemId : null,
        label: w.label,
        quantity: w.quantity,
        unit: w.unit,
        workMinutes: w.workMinutes,
        remarks: w.remarks,
        sortOrder: i,
      })),
    });
  }
  await db.dailyReportKyEntry.deleteMany({ where: { dailyReportId: reportId } });
  if (state.ky.length > 0) {
    await db.dailyReportKyEntry.createMany({
      data: state.ky.map((k, i) => ({
        dailyReportId: reportId,
        hazardId: k.hazardId && hazardIds.has(k.hazardId) ? k.hazardId : null,
        label: k.label,
        measuresJson: JSON.stringify(k.measures),
        sortOrder: i,
      })),
    });
  }

  // --- 5. 使用機械: 明細と、現場別の原価に入る経費を一緒に作る・直す・消す ---
  const existingUsages = existing?.machineUsages ?? [];
  const keptUsageIds = new Set<string>();
  const usedMachines: { includesOperator: boolean; unitPrice: number | null; name: string }[] = [];

  for (const [i, m] of state.machines.entries()) {
    const current = m.id ? existingUsages.find((u) => u.id === m.id) : undefined;
    const master = m.machineId ? machineById.get(m.machineId) : undefined;
    // 保存済みの明細は、その時点の単価をそのまま使う(あとでマスタの単価を直しても過去の日報は変わらない)。
    // 単価が未登録だったものは、マスタに単価が入っていれば今回から使う。
    const keepSnapshot = current && current.machineId === (master?.id ?? null) && current.unitPrice != null;
    const unitPrice = keepSnapshot ? current.unitPrice : (master?.unitPrice ?? null);
    const priceUnit = keepSnapshot ? current.priceUnit : (master?.priceUnit ?? "DAY");
    const includesOperator = keepSnapshot ? current.includesOperator : (master?.includesOperator ?? false);
    const amount = machineAmount(m.quantity, m.usageValue, unitPrice);
    usedMachines.push({ includesOperator, unitPrice, name: m.name });

    const expenseData = {
      targetDate: effectiveDate,
      name: m.name,
      quantity: m.quantity,
      unit: "台",
      usageHours: priceUnit === "HOUR" ? m.usageValue : null,
      unitPrice,
      amount,
      remarks: `${m.ownership === "RENTAL" ? "レンタル" : "自社所有"}(日報かんたん入力から自動作成)`,
    };

    let expenseId = current?.siteExpenseEntry?.id ?? null;
    if (current?.siteExpenseEntry && current.siteExpenseEntry.status !== "DRAFT") {
      warnings.push(`「${m.name}」の経費は確定済みのため、金額は変更していません。`);
    } else if (current?.siteExpenseEntry) {
      await db.siteExpenseEntry.update({ where: { id: current.siteExpenseEntry.id }, data: expenseData });
    } else {
      const created = await db.siteExpenseEntry.create({
        data: {
          ...expenseData,
          companyId,
          projectId,
          sourceDailyReportId: reportId,
          category: "MACHINERY",
          // 機械の金額は自社の原価(請求には混ぜない)。請求側の集計には影響しない。
          isBillable: false,
          isCostTarget: true,
          createdByUserId: actor.id,
        },
      });
      expenseId = created.id;
    }

    const usageData = {
      machineId: master?.id ?? null,
      name: m.name,
      ownership: m.ownership,
      quantity: m.quantity,
      usageValue: m.usageValue,
      priceUnit,
      includesOperator,
      unitPrice,
      amount,
      siteExpenseEntryId: expenseId,
      sortOrder: i,
    };
    if (current) {
      keptUsageIds.add(current.id);
      await db.dailyReportMachineUsage.update({ where: { id: current.id }, data: usageData });
    } else {
      const created = await db.dailyReportMachineUsage.create({ data: { ...usageData, dailyReportId: reportId } });
      keptUsageIds.add(created.id);
    }
  }
  for (const u of existingUsages) {
    if (keptUsageIds.has(u.id)) continue;
    warnings.push(...(await removeMachineUsageWithExpense(db, u)));
  }

  // --- 6. 労務: 作業員明細(既存の仕組み)に入れ、勤怠・出面へ反映する ---
  const existingWorkers = existing?.workers ?? [];
  const keptWorkerIds = new Set<string>();
  const firstForemanKey = state.labor.find((l) => l.category === "FOREMAN")?.key ?? null;

  // 従業員を入れ替えた行は、前の人の明細を消して新しい人の明細を作る(別人の勤怠・出面を書き換えない)。
  const sameIdentity = (entry: QuickState["labor"][number]) => {
    const current = entry.id ? existingWorkers.find((w) => w.id === entry.id) : undefined;
    return current && current.employeeId === entry.employeeId ? current : undefined;
  };

  for (const [i, l] of state.labor.entries()) {
    const current = sameIdentity(l);
    const employee = l.employeeId ? employeeById.get(l.employeeId) : undefined;
    const workerType: DailyReportWorkerType = employee
      ? "EMPLOYEE"
      : ((l.category && WORKER_TYPE_BY_CATEGORY[l.category]) || current?.workerType || "MANUAL");

    // 作業時間が未入力なら、1人工=会社設定の基準時間として従業員の勤怠の実働に使う。
    // 前回の保存でこの方法で入れた時間は、人工数を直したときに計算し直す(人が入力した時間は変えない)。
    const baseMinutes = (days: number) => Math.round(days * settings.manDayBaseMinutes);
    const wasDerived =
      current != null && current.workMinutes != null && current.manDays != null && current.workMinutes === baseMinutes(current.manDays);
    let workMinutes: number | null = l.workMinutes;
    if (workMinutes == null) {
      if (current && !wasDerived) workMinutes = current.workMinutes;
      else if (employee) workMinutes = baseMinutes(l.manDays);
    }
    const isForeman = firstForemanKey ? l.key === firstForemanKey : (current?.isForeman ?? false);

    const workerData = {
      workerName: employee ? employee.name : derivedWorkerName(l),
      workerType,
      role: l.category ? LABOR_CATEGORY_LABEL[l.category] : (current?.role ?? null),
      laborCategory: l.category,
      affiliation: l.affiliation,
      headcount: l.headcount,
      manDays: l.manDays,
      // 未指定(古い入力途中の内容など)のときは、保存してある内容を変えない。空欄にしたときだけ消す。
      workDescription: l.workDescription === undefined ? (current?.workDescription ?? null) : l.workDescription,
      workMinutes,
      isForeman,
      sortOrder: i,
    };

    let workerId: string;
    if (current) {
      workerId = current.id;
      await db.dailyReportWorker.update({ where: { id: current.id }, data: workerData });
    } else {
      const created = await db.dailyReportWorker.create({
        data: {
          ...workerData,
          companyId,
          dailyReportId: reportId,
          employeeId: l.employeeId,
          reflectToAttendance: Boolean(l.employeeId) && settings.autoCreateAttendanceFromDailyReport,
          reflectToSiteAttendance: true,
        },
      });
      workerId = created.id;
    }
    keptWorkerIds.add(workerId);
    audit.push(...(await reflectDailyReportWorker(db, workerId, actor, settings)));
  }

  for (const w of existingWorkers) {
    if (keptWorkerIds.has(w.id)) continue;
    const removed = await removeWorkerWithDerived(db, w, actor, settings);
    warnings.push(...removed.warnings);
    audit.push(...removed.audit);
  }

  // 作業員数・職長を、既存の項目(PDF・Excelの表示用)へそろえる。
  const workers = await db.dailyReportWorker.findMany({ where: { dailyReportId: reportId } });
  if (workers.length > 0) {
    const foreman = workers.find((w) => w.isForeman);
    await db.dailyReport.update({
      where: { id: reportId },
      data: {
        workerCount: workers.reduce((sum, w) => sum + w.headcount, 0),
        ...(foreman ? { foremanName: foreman.workerName } : {}),
      },
    });
  } else if (hadWorkers) {
    await db.dailyReport.update({ where: { id: reportId }, data: { workerCount: null } });
  }

  // --- 7. 伝えておくこと ---
  if (hasOperatorDoubleCount(usedMachines, state.labor)) {
    warnings.push(
      "運転手込みの単価の機械があり、重機オペレーターの人工も入っています。人件費を二重に数えていないか確認してください。"
    );
  }
  const employeeLines = state.labor.filter((l) => l.employeeId);
  if (employeeLines.length > 0) {
    const sameDay = await db.dailyReportWorker.findMany({
      where: { companyId, employeeId: { in: employeeLines.map((l) => l.employeeId as string) }, dailyReport: { reportDate: effectiveDate } },
      select: { employeeId: true, manDays: true, headcount: true, workerName: true },
    });
    const limit = settings.maxManDaysPerDay ?? 1;
    const totals = new Map<string, { name: string; total: number }>();
    for (const w of sameDay) {
      const t = totals.get(w.employeeId as string) ?? { name: w.workerName, total: 0 };
      t.total += (w.manDays ?? 1) * w.headcount;
      totals.set(w.employeeId as string, t);
    }
    for (const t of totals.values()) {
      if (t.total > limit + 1e-9) {
        warnings.push(
          `${t.name}さんは、同じ日の日報の合計が${Math.round(t.total * 100) / 100}人工で、${limit}人工を超えています。現場を移動した場合は、人工を現場ごとに分けて入力してください。`
        );
      }
    }
  }
  if (actor.role === "ADMIN") {
    const noPrice = usedMachines.filter((m) => m.unitPrice == null).map((m) => m.name);
    if (noPrice.length > 0) {
      warnings.push(`単価が未登録の機械があります(${noPrice.join("、")})。マスタ管理で単価を登録すると、原価に入ります。`);
    }
    const noRate: string[] = [];
    for (const l of state.labor) {
      const price = await resolveLaborUnitPrice(db, companyId, { employeeId: l.employeeId, laborCategory: l.category });
      if (price == null) noRate.push(l.workerName || (l.category ? LABOR_CATEGORY_LABEL[l.category] : "区分未選択"));
    }
    if (noRate.length > 0) {
      warnings.push(`労務単価が未登録の行があります(${[...new Set(noRate)].join("、")})。マスタ管理で登録すると、労務費に入ります。`);
    }
  }

  audit.push({
    companyId,
    userId: actor.id,
    action: existing ? "dailyReport.quickUpdate" : "dailyReport.quickCreate",
    targetType: "DailyReport",
    targetId: reportId,
  });

  return { reportId, created: !existing, warnings, audit };
}
