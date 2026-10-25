import { pickQuickEntitiesWithAi, type QuickEntityHints } from "@/lib/ai";
import type { AiUsageContext } from "@/lib/aiUsageLog";
import { extractQuickEntriesByRules, normalizeSpeech, type ExtractMasters } from "./quickExtract";
import { normalizeName } from "./standardMasters";
import type { QuickExtraction } from "./quickInput";

const ALLOWED_UNITS = new Set(["m", "㎡", "㎥", "箇所", "枚", "本"]);

/**
 * AIが選んだ名前を、会社の一覧と機械的に突き合わせてルールの結果へ足す(純粋な関数。AIの呼び出しは含まない)。
 * - 一覧にない名前は確定させず、「確認が必要」として知らせる(AIが作った名前を会社のマスタ扱いにしない)。
 * - ルールですでに取れているものは、重ねても増やさない。
 */
export function mergeAiHints(
  rules: QuickExtraction,
  hints: QuickEntityHints,
  masters: ExtractMasters
): QuickExtraction {
  const result: QuickExtraction = {
    ...rules,
    works: rules.works.map((w) => ({ ...w })),
    machines: rules.machines.map((m) => ({ ...m })),
    hazards: rules.hazards.map((h) => ({ ...h })),
    unclear: [...rules.unclear],
  };

  for (const w of hints.works) {
    const master = masters.works.find((x) => normalizeName(x.label) === normalizeName(w.name));
    if (!master) {
      result.unclear.push(`AIが読み取った作業「${w.name}」は、作業内容の一覧にありませんでした。`);
      continue;
    }
    const unit = w.unit && ALLOWED_UNITS.has(w.unit) ? w.unit : null;
    const same = result.works.find((x) => normalizeName(x.label) === normalizeName(master.label));
    if (same) {
      if (same.quantity == null && w.quantity != null && unit) {
        same.quantity = w.quantity;
        same.unit = unit;
      }
      continue;
    }
    result.works.push({
      workItemId: master.id,
      label: master.label,
      quantity: w.quantity != null && unit ? w.quantity : null,
      unit: w.quantity != null && unit ? unit : null,
    });
  }

  for (const m of hints.machines) {
    const master = masters.machines.find((x) => normalizeName(x.name) === normalizeName(m.name));
    if (!master) {
      result.unclear.push(`AIが読み取った機械「${m.name}」は、使用機械の一覧にありませんでした。`);
      continue;
    }
    if (result.machines.some((x) => normalizeName(x.name) === normalizeName(master.name))) continue;
    const quantity = m.quantity != null && m.quantity >= 1 && m.quantity <= 100 ? Math.round(m.quantity) : 1;
    result.machines.push({ machineId: master.id, name: master.name, quantity });
  }

  for (const name of hints.hazards) {
    const master = masters.hazards.find((x) => normalizeName(x.label) === normalizeName(name));
    if (!master) {
      result.unclear.push(`AIが読み取った危険「${name}」は、危険の一覧にありませんでした。`);
      continue;
    }
    if (result.hazards.some((x) => normalizeName(x.label) === normalizeName(master.label))) continue;
    result.hazards.push({ hazardId: master.id, label: master.label, measures: master.measures });
  }

  // 人数・人工・翌日の予定は、ルールで取れていないときだけAIの値を使う。
  if (result.workerCount == null && hints.workerCount != null && hints.workerCount >= 1 && hints.workerCount <= 99) {
    result.workerCount = Math.round(hints.workerCount);
  }
  if (result.manDaysTotal == null && hints.manDaysTotal != null && hints.manDaysTotal > 0 && hints.manDaysTotal <= 500) {
    result.manDaysTotal = hints.manDaysTotal;
  }
  if (!result.nextDayPlan && hints.nextDayPlan) result.nextDayPlan = hints.nextDayPlan;

  result.unclear = [...new Set(result.unclear)];
  return result;
}

/**
 * 音声・文章から作業内容・機械・人数・危険・翌日の予定を取り出す。
 * まず言葉のルールで取り出し、AIが使える環境ではAIの読み取りも足す(AIが使えない・失敗したときはルールだけ)。
 */
export async function extractQuickEntries(
  rawText: string,
  masters: ExtractMasters,
  usageContext?: AiUsageContext
): Promise<QuickExtraction> {
  const rules = extractQuickEntriesByRules(rawText, masters);
  const hints = await pickQuickEntitiesWithAi(
    normalizeSpeech(rawText),
    {
      works: masters.works.map((w) => w.label),
      machines: masters.machines.map((m) => m.name),
      hazards: masters.hazards.map((h) => h.label),
    },
    usageContext
  );
  return hints ? mergeAiHints(rules, hints, masters) : rules;
}
