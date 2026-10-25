// 日報かんたん入力の標準項目(会社ごとのマスタの初期値)と、「作業内容から機械・KYをおすすめする」対応表。
// 会社は標準項目を追加・変更・無効にできる(マスタ管理画面)。ここは初期値と、おすすめの辞書だけ。
//
// おすすめは候補を出すだけで、AIや辞書が自動で確定することはしない(人が選んで確定する)。

import type { LaborCategory } from "@/generated/prisma/enums";

export const STANDARD_WORK_ITEMS: { label: string; defaultUnit: string | null }[] = [
  { label: "掘削工", defaultUnit: "㎥" },
  { label: "床付け", defaultUnit: "㎡" },
  { label: "残土積込", defaultUnit: "㎥" },
  { label: "残土運搬", defaultUnit: "㎥" },
  { label: "砕石敷均し", defaultUnit: "㎡" },
  { label: "転圧工", defaultUnit: "㎡" },
  { label: "路盤工", defaultUnit: "㎡" },
  { label: "型枠工", defaultUnit: "㎡" },
  { label: "鉄筋工", defaultUnit: "t" },
  { label: "コンクリート打設", defaultUnit: "㎥" },
  { label: "ブロック積み", defaultUnit: "㎡" },
  { label: "擁壁工", defaultUnit: "m" },
  { label: "配管工", defaultUnit: "m" },
  { label: "汚水管布設", defaultUnit: "m" },
  { label: "雨水管布設", defaultUnit: "m" },
  { label: "桝設置", defaultUnit: "箇所" },
  { label: "側溝据付", defaultUnit: "m" },
  { label: "アスファルト舗装", defaultUnit: "㎡" },
  { label: "インターロッキング舗装", defaultUnit: "㎡" },
  { label: "測量", defaultUnit: null },
  { label: "墨出し", defaultUnit: null },
  { label: "清掃", defaultUnit: null },
  { label: "片付け", defaultUnit: null },
  { label: "その他", defaultUnit: null },
];

// 単価は標準では入れない(単価表に無いものは勝手に決めない)。会社の管理者が登録する。
export const STANDARD_MACHINES: string[] = [
  "バックホー0.1㎥",
  "バックホー0.25㎥",
  "バックホー0.45㎥",
  "3tダンプ",
  "4tダンプ",
  "7tダンプ",
  "Wキャブ",
  "軽バン",
  "プレート",
  "ランマー",
  "振動ローラー",
  "ハンドガイドローラー",
  "ブレーカー",
  "発電機",
  "水中ポンプ",
  "コンクリートカッター",
  "その他",
];

// 対策は「候補」。現場の状況に合わせて、人が選ぶ・書き直す。
export const STANDARD_HAZARDS: { label: string; measures: string[] }[] = [
  { label: "重機との接触", measures: ["作業半径内立入禁止", "合図者配置", "周囲確認"] },
  { label: "重機旋回時の接触", measures: ["旋回範囲の立入禁止", "誘導員の配置", "旋回前の合図と後方・側方の確認"] },
  { label: "掘削箇所の崩壊", measures: ["地山点検", "土留め確認", "立入範囲の管理"] },
  { label: "土砂の崩落", measures: ["法面・斜面の点検", "掘削勾配の確認", "掘削縁への重機・資材の仮置き禁止"] },
  { label: "埋設物の損傷", measures: ["埋設物位置の確認", "必要箇所の手掘り", "管理者との事前協議"] },
  { label: "架空線との接触", measures: ["架空線の位置・高さの確認", "防護カバー・離隔距離の確保", "ダンプアップ・ブーム操作時の確認"] },
  { label: "転倒・つまずき", measures: ["通路の整理整頓", "段差・開口部の表示", "安全靴の着用"] },
  { label: "資材の落下", measures: ["玉掛けの確認", "吊り荷下への立入禁止", "資材の固定・仮置き管理"] },
  { label: "挟まれ事故", measures: ["作業手順の確認", "合図者の配置", "稼働中の機械への接近禁止"] },
  { label: "第三者災害", measures: ["保安施設の設置", "交通誘導員の配置", "立入禁止措置の確認"] },
  { label: "車両事故", measures: ["誘導員の配置", "後退時の合図確認", "出入口での一時停止・歩行者確認"] },
  { label: "熱中症", measures: ["こまめな水分・塩分補給", "休憩時間の確保", "体調確認の声かけ"] },
  { label: "感電事故", measures: ["電源・分電盤の点検", "漏電遮断器の使用", "濡れた手での作業禁止"] },
  { label: "高所からの墜落", measures: ["安全帯(フルハーネス)の着用", "手すり・開口部養生の確認", "足場・はしごの点検"] },
  { label: "酸素欠乏", measures: ["酸素・硫化水素濃度の測定", "換気の実施", "監視人の配置"] },
  { label: "その他", measures: [] },
];

/** 比較用に名前をそろえる(全角半角・大文字小文字・空白の違いを無視する。㎥→m3、㎡→m2になる)。 */
export function normalizeName(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

// 作業内容 → おすすめの機械・危険。名前が一致した標準項目にだけ働く(会社が足した独自の項目は、おすすめなし)。
const WORK_SUGGESTIONS: Record<string, { machines: string[]; hazards: string[] }> = {
  掘削工: { machines: ["バックホー0.25㎥", "バックホー0.1㎥", "バックホー0.45㎥"], hazards: ["重機との接触", "重機旋回時の接触", "掘削箇所の崩壊", "埋設物の損傷"] },
  床付け: { machines: ["バックホー0.25㎥", "プレート"], hazards: ["重機との接触", "掘削箇所の崩壊"] },
  残土積込: { machines: ["バックホー0.25㎥", "4tダンプ", "3tダンプ"], hazards: ["重機との接触", "重機旋回時の接触", "車両事故"] },
  残土運搬: { machines: ["4tダンプ", "3tダンプ", "7tダンプ"], hazards: ["車両事故", "第三者災害"] },
  砕石敷均し: { machines: ["バックホー0.25㎥", "プレート"], hazards: ["重機との接触", "転倒・つまずき"] },
  転圧工: { machines: ["プレート", "ランマー", "振動ローラー", "ハンドガイドローラー"], hazards: ["挟まれ事故", "転倒・つまずき", "熱中症"] },
  路盤工: { machines: ["振動ローラー", "プレート", "4tダンプ"], hazards: ["重機との接触", "車両事故"] },
  型枠工: { machines: [], hazards: ["資材の落下", "転倒・つまずき", "挟まれ事故"] },
  鉄筋工: { machines: [], hazards: ["転倒・つまずき", "資材の落下"] },
  コンクリート打設: { machines: ["発電機"], hazards: ["感電事故", "車両事故", "転倒・つまずき"] },
  ブロック積み: { machines: ["バックホー0.25㎥"], hazards: ["資材の落下", "挟まれ事故", "転倒・つまずき"] },
  擁壁工: { machines: ["バックホー0.25㎥", "4tダンプ"], hazards: ["重機との接触", "資材の落下", "掘削箇所の崩壊", "土砂の崩落"] },
  配管工: { machines: ["バックホー0.25㎥", "水中ポンプ"], hazards: ["重機との接触", "掘削箇所の崩壊", "埋設物の損傷", "挟まれ事故"] },
  汚水管布設: { machines: ["バックホー0.25㎥", "水中ポンプ", "発電機"], hazards: ["掘削箇所の崩壊", "重機との接触", "埋設物の損傷", "酸素欠乏"] },
  雨水管布設: { machines: ["バックホー0.25㎥", "水中ポンプ"], hazards: ["掘削箇所の崩壊", "重機との接触", "埋設物の損傷"] },
  桝設置: { machines: ["バックホー0.25㎥", "プレート"], hazards: ["重機との接触", "挟まれ事故", "資材の落下"] },
  側溝据付: { machines: ["バックホー0.25㎥", "コンクリートカッター"], hazards: ["重機との接触", "挟まれ事故", "資材の落下"] },
  アスファルト舗装: { machines: ["振動ローラー", "ハンドガイドローラー", "4tダンプ"], hazards: ["熱中症", "車両事故", "第三者災害"] },
  インターロッキング舗装: { machines: ["プレート", "軽バン"], hazards: ["転倒・つまずき", "熱中症"] },
  測量: { machines: [], hazards: ["第三者災害", "転倒・つまずき"] },
  墨出し: { machines: [], hazards: ["転倒・つまずき"] },
  清掃: { machines: [], hazards: ["転倒・つまずき", "熱中症"] },
  片付け: { machines: [], hazards: ["資材の落下", "転倒・つまずき", "挟まれ事故"] },
};

// 使う機械 → 気をつける危険(機械の名前に含まれる言葉で判定)。
const MACHINE_HAZARD_RULES: { keyword: string; hazards: string[] }[] = [
  { keyword: "バックホー", hazards: ["重機との接触", "重機旋回時の接触"] },
  { keyword: "ダンプ", hazards: ["車両事故", "第三者災害"] },
  { keyword: "発電機", hazards: ["感電事故"] },
  { keyword: "水中ポンプ", hazards: ["感電事故"] },
  { keyword: "ローラー", hazards: ["挟まれ事故"] },
];

function pushUnique(target: string[], values: string[]) {
  for (const v of values) if (!target.includes(v)) target.push(v);
}

/** 選んだ作業内容から、おすすめの機械の名前を返す(重複なし。選んだ順)。 */
export function suggestMachinesForWorks(workLabels: string[]): string[] {
  const result: string[] = [];
  for (const label of workLabels) pushUnique(result, WORK_SUGGESTIONS[label]?.machines ?? []);
  return result;
}

/**
 * 選んだ作業内容と使用機械から、おすすめの危険(KY)のラベルを返す。
 * 作業内容に由来するものを先に、そのあとに機械に由来するものを並べる(重複なし)。
 */
export function suggestHazardsFor(workLabels: string[], machineNames: string[]): string[] {
  const result: string[] = [];
  for (const label of workLabels) pushUnique(result, WORK_SUGGESTIONS[label]?.hazards ?? []);
  for (const name of machineNames) {
    for (const rule of MACHINE_HAZARD_RULES) {
      if (name.includes(rule.keyword)) pushUnique(result, rule.hazards);
    }
  }
  return result;
}

// --- 労務の区分 ---

export const LABOR_CATEGORIES: LaborCategory[] = [
  "OWN_EMPLOYEE",
  "FOREMAN",
  "OPERATOR",
  "SUBCONTRACT_WORKER",
  "SUPPORT_WORKER",
  "OTHER",
];

export const LABOR_CATEGORY_LABEL: Record<LaborCategory, string> = {
  OWN_EMPLOYEE: "自社社員",
  FOREMAN: "職長",
  OPERATOR: "重機オペレーター",
  SUBCONTRACT_WORKER: "外注作業員",
  SUPPORT_WORKER: "応援作業員",
  OTHER: "その他",
};

/** 人工数の選択肢(1人工=1日分。0.5=半日、0.25=2時間ぶんの目安は基準時間の1/4)。 */
export const MAN_DAY_CHOICES = [1, 0.5, 0.25] as const;

/** 作業時間(時間)から人工数を出す。基準時間(分)は会社設定。0.25刻みに丸める。 */
export function manDaysFromHours(hours: number, baseMinutes: number): number | null {
  if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(baseMinutes) || baseMinutes <= 0) return null;
  const raw = (hours * 60) / baseMinutes;
  return Math.round(raw * 4) / 4;
}
