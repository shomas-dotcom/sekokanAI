"use client";

import type { LaborCategory } from "@/generated/prisma/enums";
import type { QuickMasterData } from "@/lib/dailyReport/masters";
import {
  hasOperatorDoubleCount,
  laborAmount,
  totalHeadcount,
  totalManDays,
  type QuickLabor,
  type QuickMachine,
} from "@/lib/dailyReport/quickInput";
import { LABOR_CATEGORIES, LABOR_CATEGORY_LABEL, MAN_DAY_CHOICES, manDaysFromHours } from "@/lib/dailyReport/standardMasters";
import { FieldBox, SelectedCard, Stepper, inputClass, newKey, yen } from "./parts";

// 従業員をマスタから選べる区分。外注・応援・その他は、名前・所属会社・人数で入れる。
const EMPLOYEE_CATEGORIES: (LaborCategory | null)[] = ["OWN_EMPLOYEE", "FOREMAN", "OPERATOR"];

export function priceFor(labor: QuickLabor, masters: QuickMasterData): number | null {
  const rates = masters.laborRates;
  if (!rates) return null;
  if (labor.employeeId && rates.byEmployee[labor.employeeId] != null) return rates.byEmployee[labor.employeeId];
  if (labor.category && rates.byCategory[labor.category] != null) return rates.byCategory[labor.category] ?? null;
  return null;
}

export function LaborTab({
  masters,
  labor,
  machines,
  workLabels,
  onChange,
}: {
  masters: QuickMasterData;
  labor: QuickLabor[];
  machines: QuickMachine[];
  /** 選んだ作業内容(「担当した作業」の入力候補に使う)。 */
  workLabels: string[];
  onChange: (labor: QuickLabor[]) => void;
}) {
  function addLine(category: LaborCategory) {
    onChange([
      ...labor,
      {
        key: newKey(),
        id: null,
        category,
        employeeId: null,
        workerName: "",
        affiliation: null,
        headcount: 1,
        manDays: 1,
        workMinutes: null,
      },
    ]);
  }

  function update(key: string, patch: Partial<QuickLabor>) {
    onChange(labor.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const machinesWithOperator = machines.map((m) => ({
    includesOperator: masters.machines.find((x) => x.id === m.machineId)?.includesOperator ?? false,
  }));
  const doubleCount = hasOperatorDoubleCount(machinesWithOperator, labor);

  const amounts = labor.map((l) => laborAmount(l.headcount, l.manDays, priceFor(l, masters)));
  const amountTotal = amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const missingCount = amounts.filter((a) => a == null).length;
  const baseHours = Math.round((masters.manDayBaseMinutes / 60) * 100) / 100;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">人員を追加(区分を押してください)</p>
        <div className="grid grid-cols-2 gap-2.5">
          {LABOR_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => addLine(c)}
              className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-[15px] font-semibold text-slate-700 active:scale-[0.98] active:border-amber-400"
            >
              ＋ {LABOR_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {doubleCount && (
        <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">
          運転手込みの単価の機械を選んでいます。重機オペレーターの人工も入れると、人件費が二重になる場合があります。
        </p>
      )}

      {labor.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          まだ人員が入っていません。上の区分を押して追加してください。
        </p>
      )}

      {labor.map((l, i) => {
        const usesEmployee = EMPLOYEE_CATEGORIES.includes(l.category);
        const amount = amounts[i];
        const usedByOthers = new Set(labor.filter((x) => x.key !== l.key && x.employeeId).map((x) => x.employeeId));
        const hours = l.workMinutes == null ? "" : String(Math.round((l.workMinutes / 60) * 100) / 100);
        return (
          <SelectedCard
            key={l.key}
            title={
              l.category ? (
                LABOR_CATEGORY_LABEL[l.category]
              ) : (
                <span className="text-amber-700">区分を選んでください</span>
              )
            }
            onRemove={() => onChange(labor.filter((x) => x.key !== l.key))}
            warning={!l.category ? "音声から入った人員です。区分と人工数を確認してください。" : null}
          >
            <FieldBox label="区分">
              <select
                value={l.category ?? ""}
                onChange={(e) => {
                  const category = (e.target.value || null) as LaborCategory | null;
                  // 従業員を選べない区分に変えたら、選んでいた従業員は外す(別人の単価で計算されないように)。
                  update(l.key, { category, ...(EMPLOYEE_CATEGORIES.includes(category) ? {} : { employeeId: null }) });
                }}
                className={inputClass}
              >
                <option value="">選んでください</option>
                {LABOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LABOR_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </FieldBox>

            {usesEmployee && (
              <FieldBox label="従業員(選ぶと勤怠・出面に結びつきます)">
                <select
                  value={l.employeeId ?? ""}
                  onChange={(e) => {
                    const employeeId = e.target.value || null;
                    const employee = masters.employees.find((x) => x.id === employeeId);
                    update(l.key, { employeeId, headcount: 1, workerName: employee ? employee.name : l.workerName });
                  }}
                  className={inputClass}
                >
                  <option value="">選ばない(名前を直接入力)</option>
                  {masters.employees.map((e) => (
                    <option key={e.id} value={e.id} disabled={usedByOthers.has(e.id)}>
                      {e.name}
                      {usedByOthers.has(e.id) ? "(入力済み)" : ""}
                    </option>
                  ))}
                </select>
              </FieldBox>
            )}

            {!l.employeeId && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldBox label="作業員名(任意)">
                    <input
                      value={l.workerName}
                      onChange={(e) =>
                        update(l.key, {
                          workerName: e.target.value,
                          // 名前を入れたら1名分の行にする(人数のまとめ入力と区別するため)
                          ...(e.target.value.trim() ? { headcount: 1 } : {}),
                        })
                      }
                      className={inputClass}
                      maxLength={100}
                    />
                  </FieldBox>
                  <FieldBox label="所属会社(任意)">
                    <input
                      value={l.affiliation ?? ""}
                      onChange={(e) => update(l.key, { affiliation: e.target.value || null })}
                      className={inputClass}
                      maxLength={100}
                    />
                  </FieldBox>
                </div>
                {!l.workerName.trim() && (
                  <div className="flex flex-col gap-1 text-sm font-medium text-slate-600">
                    <span>人数</span>
                    <Stepper
                      label="人数"
                      value={l.headcount}
                      min={1}
                      max={99}
                      onChange={(headcount) => update(l.key, { headcount })}
                    />
                  </div>
                )}
              </>
            )}

            <FieldBox label="担当した作業(任意)">
              <input
                value={l.workDescription ?? ""}
                onChange={(e) => update(l.key, { workDescription: e.target.value || null })}
                list={`work-labels-${l.key}`}
                placeholder="例: 掘削、配管"
                className={inputClass}
                maxLength={200}
              />
              <datalist id={`work-labels-${l.key}`}>
                {workLabels.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </FieldBox>

            <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
              <span>人工数(1人あたり)</span>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label="人工数">
                {MAN_DAY_CHOICES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={l.manDays === d}
                    onClick={() => update(l.key, { manDays: d })}
                    className={`min-h-12 rounded-xl border-2 text-base font-semibold ${
                      l.manDays === d ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {d.toFixed(2).replace(/0$/, "")}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.05}
                  max={10}
                  step="0.05"
                  value={l.manDays}
                  onChange={(e) => update(l.key, { manDays: e.target.value === "" ? 0 : Number(e.target.value) })}
                  aria-label="人工数を数字で入力"
                  className={`${inputClass} text-center`}
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] items-end gap-2.5">
              <FieldBox label={`作業時間(任意・時間。1人工=${baseHours}時間)`}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step="0.5"
                  value={hours}
                  onChange={(e) =>
                    update(l.key, { workMinutes: e.target.value === "" ? null : Math.round(Number(e.target.value) * 60) })
                  }
                  className={inputClass}
                />
              </FieldBox>
              <button
                type="button"
                disabled={l.workMinutes == null}
                onClick={() => {
                  const manDays = manDaysFromHours((l.workMinutes ?? 0) / 60, masters.manDayBaseMinutes);
                  if (manDays != null && manDays > 0) update(l.key, { manDays });
                }}
                className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 active:bg-slate-100"
              >
                時間から
                <br />
                人工を計算
              </button>
            </div>

            <p className="text-sm text-slate-700">
              合計 {l.headcount}名 × {l.manDays}人工 = <span className="font-semibold">{Math.round(l.headcount * l.manDays * 100) / 100}人工</span>
            </p>
            {masters.canSeeCosts && (
              <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                {amount != null ? (
                  <>
                    労務費(目安) <span className="font-semibold">{yen(amount)}</span>
                  </>
                ) : (
                  <span className="text-amber-700">労務単価未登録(マスタ管理で登録すると金額が出ます)</span>
                )}
              </p>
            )}
          </SelectedCard>
        );
      })}

      {labor.length > 0 && (
        <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-800">
          合計: {totalHeadcount(labor)}名 / {totalManDays(labor)}人工
          {masters.canSeeCosts && (
            <>
              {" "}
              / 労務費(目安) {yen(amountTotal)}
              {missingCount > 0 && <span className="text-amber-700">(単価未登録 {missingCount}行は含まず)</span>}
            </>
          )}
        </p>
      )}
    </div>
  );
}
