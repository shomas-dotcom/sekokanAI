// 音声(または自由記述)の文章から、作業内容・数量・使用機械・作業人数・人工数・KY・翌日の予定を取り出す。
// ここは「言葉のルール」だけで動く部分(AIの接続がなくても動く)。AIを使う場合も、AIが返すのは
// 「名前・数字」までで、会社のマスタとの突き合わせはこの関数と同じ仕組みで機械的に行う。
// 単価・金額は一切ここで決めない(マスタに無いものは「単価未登録」のまま人が確認する)。

import { normalizeName } from "./standardMasters";
import type { QuickExtraction } from "./quickInput";

export type ExtractMasters = {
  works: { id: string; label: string }[];
  machines: { id: string; name: string }[];
  hazards: { id: string; label: string; measures: string[] }[];
};

/** 音声認識の言い回しの揺れ(トン・メートル・立米など)を、突き合わせしやすい形にそろえる。 */
export function normalizeSpeech(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/平方メートル|平米/g, "m2")
    .replace(/立方メートル|立米/g, "m3")
    .replace(/メートル/g, "m")
    .replace(/トン/g, "t")
    .replace(/ヶ所|カ所|か所|ヵ所/g, "箇所");
}

const UNIT_LABEL: Record<string, string> = { m3: "㎥", m2: "㎡", m: "m", 箇所: "箇所", 枚: "枚", 本: "本", 個: "個" };
const QUANTITY_PATTERN = /(\d+(?:\.\d+)?)(m3|m2|m|箇所|枚|本|個)/;

// 標準の作業内容を、よくある言い方で見つけるための言葉。会社が足した独自の作業内容は、名前そのままで探す。
const WORK_ALIASES: Record<string, RegExp[]> = {
  掘削工: [/掘削/],
  床付け: [/床付/],
  残土積込: [/残土.*(積込|積み込み|積)/],
  残土運搬: [/残土.*(運搬|搬出|処分)/],
  砕石敷均し: [/砕石/],
  転圧工: [/転圧|締固め|締め固め/],
  路盤工: [/路盤/],
  型枠工: [/型枠/],
  鉄筋工: [/鉄筋|配筋/],
  コンクリート打設: [/コンクリート.*打設|打設/],
  ブロック積み: [/ブロック積/],
  擁壁工: [/擁壁/],
  配管工: [/配管/],
  汚水管布設: [/汚水管|汚水/],
  雨水管布設: [/雨水管|雨水/],
  桝設置: [/桝|マス設置|枡/],
  側溝据付: [/側溝/],
  アスファルト舗装: [/アスファルト|舗装(?!.*インターロッキング)/],
  インターロッキング舗装: [/インターロッキング|ilb/],
  測量: [/測量/],
  墨出し: [/墨出/],
  清掃: [/清掃/],
  片付け: [/片付|後片付/],
};

const HAZARD_ALIASES: Record<string, RegExp[]> = {
  重機との接触: [/重機(との|に)?接触|重機接触|バックホ[ーウ]との接触/],
  重機旋回時の接触: [/旋回/],
  掘削箇所の崩壊: [/崩壊|掘削.*崩れ/],
  土砂の崩落: [/崩落|土砂.*崩れ|法面/],
  埋設物の損傷: [/埋設/],
  架空線との接触: [/架空線|電線/],
  "転倒・つまずき": [/転倒|つまずき|躓き/],
  資材の落下: [/落下/],
  挟まれ事故: [/挟まれ|はさまれ|巻き込まれ/],
  第三者災害: [/第三者|歩行者|通行人/],
  車両事故: [/車両事故|交通事故|後退時/],
  熱中症: [/熱中症|暑さ/],
  感電事故: [/感電/],
  高所からの墜落: [/墜落|転落|高所/],
  酸素欠乏: [/酸素欠乏|酸欠|硫化水素/],
};

// 機械を名前で探す言葉(大きさで見分けるバックホー・ダンプは別に扱う)。
const MACHINE_KEYWORDS: { canonical: string; pattern: RegExp }[] = [
  { canonical: "Wキャブ", pattern: /wキャブ|ダブルキャブ/gi },
  { canonical: "軽バン", pattern: /軽バン/g },
  { canonical: "ハンドガイドローラー", pattern: /ハンドガイド(?:ローラ[ー]?)?/g },
  { canonical: "振動ローラー", pattern: /振動ローラ[ー]?|ロードローラ[ー]?/g },
  { canonical: "プレート", pattern: /プレート(?:コンパクタ[ー]?)?/g },
  { canonical: "ランマー", pattern: /ランマ[ー]?/g },
  { canonical: "ブレーカー", pattern: /ブレーカ[ー]?/g },
  { canonical: "発電機", pattern: /発電機/g },
  { canonical: "水中ポンプ", pattern: /水中ポンプ/g },
  { canonical: "コンクリートカッター", pattern: /コンクリートカッタ[ー]?/g },
];

type MachineMention = { start: number; end: number; name: string; machineId: string | null; known: boolean };

function sizeOf(name: string): number | null {
  const match = normalizeName(name).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

/** 文の中から機械の言及を見つける。大きさの分からないバックホー・ダンプは、unclear に積む。 */
function findMachines(sentence: string, masters: ExtractMasters, unclear: string[]): MachineMention[] {
  const mentions: MachineMention[] = [];
  const lower = sentence.toLowerCase();

  // バックホー: 「0.25バックホウ」「バックホー0.25」「0.25m3のバックホウ」「0.25BH」
  const bhRe = /(?:(\d+(?:\.\d+)?)(?:m3)?(?:の)?(?:バックホ[ーウ]|ユンボ|bh)|(?:バックホ[ーウ]|ユンボ|bh)(\d+(?:\.\d+)?)(?:m3)?)/g;
  let m: RegExpExecArray | null;
  const bhSpans: [number, number][] = [];
  while ((m = bhRe.exec(lower))) {
    const size = Number(m[1] ?? m[2]);
    bhSpans.push([m.index, m.index + m[0].length]);
    const master = masters.machines.find(
      (x) => /^バックホ/.test(normalizeName(x.name)) && sizeOf(x.name) === size
    );
    mentions.push({
      start: m.index,
      end: m.index + m[0].length,
      name: master?.name ?? `バックホー${size}㎥`,
      machineId: master?.id ?? null,
      known: Boolean(master),
    });
  }
  // 大きさのないバックホー(「バックホウを使用」)。どの大きさか分からないので入れずに確認を促す。
  const bareBh = /バックホ[ーウ]|ユンボ|bh/g;
  while ((m = bareBh.exec(lower))) {
    const inside = bhSpans.some(([s, e]) => m!.index >= s && m!.index < e);
    if (!inside) unclear.push("バックホーの大きさ(0.1・0.25・0.45㎥など)が聞き取れませんでした。機械を選んでください。");
  }

  // ダンプ: 「4tダンプ」「4トンダンプ」
  const dumpRe = /(\d+(?:\.\d+)?)t(?:の)?ダンプ(?:トラック)?/g;
  const dumpSpans: [number, number][] = [];
  while ((m = dumpRe.exec(lower))) {
    const size = Number(m[1]);
    dumpSpans.push([m.index, m.index + m[0].length]);
    const master = masters.machines.find((x) => /ダンプ/.test(x.name) && sizeOf(x.name) === size);
    mentions.push({
      start: m.index,
      end: m.index + m[0].length,
      name: master?.name ?? `${size}tダンプ`,
      machineId: master?.id ?? null,
      known: Boolean(master),
    });
  }
  const bareDump = /ダンプ/g;
  while ((m = bareDump.exec(lower))) {
    const inside = dumpSpans.some(([s, e]) => m!.index >= s && m!.index < e);
    if (!inside) unclear.push("ダンプの大きさ(3t・4t・7t)が聞き取れませんでした。機械を選んでください。");
  }

  for (const { canonical, pattern } of MACHINE_KEYWORDS) {
    pattern.lastIndex = 0;
    while ((m = pattern.exec(lower))) {
      const start = m.index;
      const end = start + m[0].length;
      // ハンドガイドローラーの中の「ローラー」を振動ローラーと数えない等、重なった言及は先に見つけたほうを残す
      if (mentions.some((x) => start < x.end && end > x.start)) continue;
      const master = masters.machines.find((x) => normalizeName(x.name) === normalizeName(canonical));
      mentions.push({ start, end, name: master?.name ?? canonical, machineId: master?.id ?? null, known: Boolean(master) });
    }
  }

  return mentions.sort((a, b) => a.start - b.start);
}

function machineQuantity(sentence: string, mention: MachineMention, next: MachineMention | undefined): number {
  const after = sentence.slice(mention.end, next ? next.start : undefined);
  const afterMatch = after.match(/^[をがは、,\s]{0,2}(\d+)台/);
  if (afterMatch) return Number(afterMatch[1]);
  const before = sentence.slice(Math.max(0, mention.start - 6), mention.start);
  const beforeMatch = before.match(/(\d+)台(?:の)?$/);
  if (beforeMatch) return Number(beforeMatch[1]);
  return 1;
}

export function extractQuickEntriesByRules(rawText: string, masters: ExtractMasters): QuickExtraction {
  const text = normalizeSpeech(rawText);
  const result: QuickExtraction = {
    works: [],
    machines: [],
    workerCount: null,
    manDaysTotal: null,
    hazards: [],
    nextDayPlan: null,
    unclear: [],
  };
  const unclear = new Set<string>();

  const sentences = text.split(/[。\n]/).map((s) => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    const unclearHere: string[] = [];
    const mentions = findMachines(sentence, masters, unclearHere);
    unclearHere.forEach((u) => unclear.add(u));

    mentions.forEach((mention, i) => {
      const quantity = machineQuantity(sentence, mention, mentions[i + 1]);
      const same = result.machines.find((x) => normalizeName(x.name) === normalizeName(mention.name));
      if (same) {
        same.quantity = Math.max(same.quantity, quantity);
        return;
      }
      result.machines.push({ machineId: mention.machineId, name: mention.name, quantity });
      if (!mention.known) unclear.add(`「${mention.name}」は機械マスタにありません。単価は未登録として入れました。`);
    });

    // 数量は、機械の言及(0.25m3のバックホウ)や人数を取り除いた文から探す(取り違えを防ぐ)。
    let forQuantity = sentence;
    for (const mention of [...mentions].reverse()) {
      forQuantity = forQuantity.slice(0, mention.start) + " ".repeat(mention.end - mention.start) + forQuantity.slice(mention.end);
    }
    const quantityMatch = forQuantity.match(QUANTITY_PATTERN);

    const matchedWorks: { id: string; label: string }[] = [];
    for (const work of masters.works) {
      const aliases = WORK_ALIASES[work.label];
      const lowered = sentence.toLowerCase();
      const hit =
        (aliases ? aliases.some((re) => re.test(lowered)) : false) || lowered.includes(normalizeName(work.label));
      if (hit) matchedWorks.push(work);
    }
    // 1つの文に作業が複数あるときは、どの数量がどの作業のものか決められないので数量は入れない。
    for (const work of matchedWorks) {
      if (result.works.some((x) => normalizeName(x.label) === normalizeName(work.label))) continue;
      const single = matchedWorks.length === 1 && quantityMatch;
      result.works.push({
        workItemId: work.id,
        label: work.label,
        quantity: single ? Number(quantityMatch[1]) : null,
        unit: single ? UNIT_LABEL[quantityMatch[2]] : null,
      });
    }
    if (matchedWorks.length > 1 && quantityMatch) {
      unclear.add(`「${sentence.slice(0, 30)}」には作業が複数あるため、数量(${quantityMatch[0]})は入れていません。`);
    }
  }

  // 作業員数・人工数(文章全体から)。「4人工」は人数に数えない。
  for (const m of text.matchAll(/(\d+)\s*(?:名|人)(?!工)/g)) {
    result.workerCount = (result.workerCount ?? 0) + Number(m[1]);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*人工/g)) {
    result.manDaysTotal = (result.manDaysTotal ?? 0) + Number(m[1]);
  }

  // 危険予知: マスタの危険(言い方の揺れも含む)と、会社が足した独自の危険を見つける。
  const lowered = text.toLowerCase();
  for (const hazard of masters.hazards) {
    const aliases = HAZARD_ALIASES[hazard.label];
    const hit = (aliases ? aliases.some((re) => re.test(lowered)) : false) || lowered.includes(normalizeName(hazard.label));
    if (hit) result.hazards.push({ hazardId: hazard.id, label: hazard.label, measures: hazard.measures });
  }

  const nextDay = text.match(/(?:翌日|明日)は?([^。]+)/);
  result.nextDayPlan = nextDay ? nextDay[1].trim() : null;

  result.unclear = [...unclear];
  return result;
}
