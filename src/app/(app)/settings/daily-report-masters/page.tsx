import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Input, Select } from "@/components/ui";
import { ensureDailyReportMasters, MASTER_ORDER, parseMeasures } from "@/lib/dailyReport/masters";
import { LABOR_CATEGORIES, LABOR_CATEGORY_LABEL } from "@/lib/dailyReport/standardMasters";
import { getOrCreateWorkSettings } from "@/lib/timesheet/settings";
import {
  moveMasterAction,
  restoreStandardMastersAction,
  saveHazardMasterAction,
  saveLaborRatesAction,
  saveMachineMasterAction,
  saveWorkItemMasterAction,
} from "./actions";

// 日報かんたん入力のマスタ管理(管理者専用)。作業内容・使用機械・労務単価・KYを、会社ごとに
// 追加・変更・無効化・並べ替えできる。金額(機械の単価・労務単価)は管理者だけが見られる。

type Tab = "work" | "machine" | "labor" | "ky";

const TABS: { id: Tab; label: string }[] = [
  { id: "work", label: "作業内容" },
  { id: "machine", label: "使用機械" },
  { id: "labor", label: "労務単価" },
  { id: "ky", label: "KY(危険と対策)" },
];

const fieldClass = "text-base!";
const smallButton =
  "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50";
const saveButton =
  "min-h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 text-sm font-semibold text-white shadow-sm";

function MoveButtons({ kind, id }: { kind: string; id: string }) {
  return (
    <div className="flex gap-1">
      {(["up", "down"] as const).map((direction) => (
        <form key={direction} action={moveMasterAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value={direction} />
          <button type="submit" className={smallButton} aria-label={direction === "up" ? "1つ上へ" : "1つ下へ"}>
            {direction === "up" ? "▲" : "▼"}
          </button>
        </form>
      ))}
    </div>
  );
}

function Checks({ favorite, active }: { favorite: boolean; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" name="isFavorite" defaultChecked={favorite} className="h-5 w-5" /> ★ よく使う(先頭に出す)
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" name="isActive" defaultChecked={active} className="h-5 w-5" /> 入力画面に出す
      </label>
    </div>
  );
}

export default async function DailyReportMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; saved?: string }>;
}) {
  const { tab: tabParam, error, saved } = await searchParams;
  const user = await requireAdmin();
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "work";
  const companyId = user.companyId;
  await ensureDailyReportMasters(companyId);

  const settings = await getOrCreateWorkSettings(companyId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/settings" className="text-sm text-slate-500 underline">
          ← 会社設定にもどる
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">日報マスタ管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          日報の入力画面に出る「作業内容・使用機械・KY」と、原価の計算に使う単価を管理します。管理者だけが開けます。
          項目は消さずに「入力画面に出す」を外すと、画面から外せます(過去の日報はそのまま残ります)。
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="マスタの種類">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/settings/daily-report-masters?tab=${t.id}`}
            className={
              tab === t.id
                ? "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">保存しました。</p>}

      {tab === "work" && <WorkSection companyId={companyId} />}
      {tab === "machine" && <MachineSection companyId={companyId} />}
      {tab === "ky" && <HazardSection companyId={companyId} />}
      {tab === "labor" && <LaborSection companyId={companyId} manDayBaseMinutes={settings.manDayBaseMinutes} />}
    </div>
  );
}

async function WorkSection({ companyId }: { companyId: string }) {
  const works = await prisma.workItemMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER });
  return (
    <>
      <Card>
        <h2 className="font-semibold text-slate-900">作業内容を追加</h2>
        <form action={saveWorkItemMasterAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            名前
            <Input name="label" required maxLength={100} placeholder="例: 法面保護" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            単位の初期値
            <Input name="defaultUnit" maxLength={10} placeholder="例: ㎡" className={fieldClass} />
          </label>
          <button type="submit" className={saveButton}>
            追加する
          </button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">作業内容の一覧({works.length}件)</h2>
          <form action={restoreStandardMastersAction}>
            <button type="submit" className={smallButton}>
              足りない標準項目を戻す
            </button>
          </form>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {works.map((w) => (
            <li key={w.id} className={`rounded-xl border p-3 ${w.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <form action={saveWorkItemMasterAction} className="flex flex-1 flex-col gap-2">
                  <input type="hidden" name="id" value={w.id} />
                  <div className="grid grid-cols-[1fr_6rem] gap-2">
                    <Input name="label" defaultValue={w.label} required maxLength={100} aria-label="名前" className={fieldClass} />
                    <Input name="defaultUnit" defaultValue={w.defaultUnit ?? ""} maxLength={10} aria-label="単位の初期値" placeholder="単位" className={fieldClass} />
                  </div>
                  <Checks favorite={w.isFavorite} active={w.isActive} />
                  <button type="submit" className={`${smallButton} w-fit`}>
                    保存
                  </button>
                </form>
                <MoveButtons kind="work" id={w.id} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

async function MachineSection({ companyId }: { companyId: string }) {
  const machines = await prisma.machineMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER });
  return (
    <>
      <Card>
        <h2 className="font-semibold text-slate-900">機械を追加</h2>
        <p className="mt-1 text-xs text-slate-500">
          単価は空欄のままでも登録できます(単価未登録として、金額は出ません)。単価表にないものは、確認できてから入れてください。
        </p>
        <form action={saveMachineMasterAction} className="mt-3 flex flex-col gap-3">
          <MachineFields />
          <button type="submit" className={`${saveButton} w-fit`}>
            追加する
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">機械の一覧({machines.length}件)</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {machines.map((m) => (
            <li key={m.id} className={`rounded-xl border p-3 ${m.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <form action={saveMachineMasterAction} className="flex flex-1 flex-col gap-3">
                  <input type="hidden" name="id" value={m.id} />
                  <MachineFields machine={m} />
                  <Checks favorite={m.isFavorite} active={m.isActive} />
                  <button type="submit" className={`${smallButton} w-fit`}>
                    保存
                  </button>
                </form>
                <MoveButtons kind="machine" id={m.id} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function MachineFields({
  machine,
}: {
  machine?: { name: string; ownership: string; unitPrice: number | null; priceUnit: string; includesOperator: boolean };
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
        名前
        <Input name="name" defaultValue={machine?.name} required maxLength={100} placeholder="例: バックホー0.25㎥" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        単価(円・原価)
        <Input
          name="unitPrice"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={machine?.unitPrice ?? ""}
          placeholder="未登録"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        単価の単位
        <Select name="priceUnit" defaultValue={machine?.priceUnit ?? "DAY"} className={fieldClass}>
          <option value="DAY">1日あたり</option>
          <option value="HOUR">1時間あたり</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
        入力時の初期値
        <Select name="ownership" defaultValue={machine?.ownership ?? "OWN"} className={fieldClass}>
          <option value="OWN">自社所有</option>
          <option value="RENTAL">レンタル</option>
        </Select>
      </label>
      <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
        <input type="checkbox" name="includesOperator" defaultChecked={machine?.includesOperator} className="h-5 w-5" />
        運転手込みの単価(オペレーターの人工を別に入れると二重になります)
      </label>
    </div>
  );
}

async function HazardSection({ companyId }: { companyId: string }) {
  const hazards = await prisma.kyHazardMaster.findMany({ where: { companyId }, orderBy: MASTER_ORDER });
  return (
    <>
      <Card>
        <h2 className="font-semibold text-slate-900">危険を追加</h2>
        <form action={saveHazardMasterAction} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            危険の名前
            <Input name="label" required maxLength={100} placeholder="例: ハチの巣" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            対策の候補(1行に1つ)
            <textarea name="measures" rows={3} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-base" placeholder={"例:\n作業前に巣の有無を確認する\n防護ネットを着用する"} />
          </label>
          <button type="submit" className={`${saveButton} w-fit`}>
            追加する
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold text-slate-900">危険と対策の一覧({hazards.length}件)</h2>
        <p className="mt-1 text-xs text-slate-500">
          対策は「候補」です。現場では、人が選んだものだけが日報に残ります(自動では確定しません)。
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {hazards.map((h) => (
            <li key={h.id} className={`rounded-xl border p-3 ${h.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <form action={saveHazardMasterAction} className="flex flex-1 flex-col gap-2">
                  <input type="hidden" name="id" value={h.id} />
                  <Input name="label" defaultValue={h.label} required maxLength={100} aria-label="危険の名前" className={fieldClass} />
                  <textarea
                    name="measures"
                    rows={3}
                    defaultValue={parseMeasures(h.measuresJson).join("\n")}
                    aria-label="対策の候補(1行に1つ)"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-base"
                  />
                  <Checks favorite={h.isFavorite} active={h.isActive} />
                  <button type="submit" className={`${smallButton} w-fit`}>
                    保存
                  </button>
                </form>
                <MoveButtons kind="hazard" id={h.id} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

async function LaborSection({ companyId, manDayBaseMinutes }: { companyId: string; manDayBaseMinutes: number }) {
  const [categoryRates, employeeRates, employees] = await Promise.all([
    prisma.laborCategoryRate.findMany({ where: { companyId } }),
    prisma.employeeLaborRate.findMany({ where: { companyId } }),
    prisma.employee.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const byCategory = new Map(categoryRates.map((r) => [r.category, r.dailyUnitPrice]));
  const byEmployee = new Map(employeeRates.map((r) => [r.employeeId, r.dailyUnitPrice]));

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">労務単価(1人工あたり・円)</h2>
      <p className="mt-1 text-xs text-slate-500">
        労務費 = 人工数 × 単価 で自動計算します。従業員ごとの単価があれば、区分ごとの単価より先に使います。
        空欄は「未登録」で、金額は出ません(0円にはしません)。この画面と金額は管理者だけが見られます。
      </p>
      <form action={saveLaborRatesAction} className="mt-4 flex flex-col gap-5">
        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-slate-700">
          1人工とみなす作業時間(時間)
          <Input
            name="manDayHours"
            type="number"
            inputMode="decimal"
            min={1}
            max={24}
            step="0.25"
            required
            defaultValue={Math.round((manDayBaseMinutes / 60) * 100) / 100}
            className={fieldClass}
          />
          <span className="text-xs font-normal text-slate-500">
            日報で作業時間から人工を計算するときの基準です(残業の計算に使う所定労働時間とは別です)。
          </span>
        </label>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">区分ごとの単価</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {LABOR_CATEGORIES.map((c) => (
              <label key={c} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                {LABOR_CATEGORY_LABEL[c]}
                <Input
                  name={`cat_${c}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  defaultValue={byCategory.get(c) ?? ""}
                  placeholder="未登録"
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">従業員ごとの単価</h3>
          {employees.length === 0 ? (
            <p className="text-sm text-slate-500">従業員が登録されていません。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {employees.map((e) => (
                <label key={e.id} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  {e.name}
                  <Input
                    name={`emp_${e.id}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    defaultValue={byEmployee.get(e.id) ?? ""}
                    placeholder="区分の単価を使う"
                    className={fieldClass}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className={`${saveButton} w-fit`}>
          まとめて保存する
        </button>
      </form>
    </Card>
  );
}
