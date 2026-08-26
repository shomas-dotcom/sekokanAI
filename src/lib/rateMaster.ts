import type { RateCategory } from "@/generated/prisma/enums";

export const RATE_CATEGORY_LABEL: Record<RateCategory, string> = {
  LABOR: "作業員人工",
  FOREMAN_LABOR: "世話役人工",
  MACHINERY: "重機",
  DUMP_TRUCK: "ダンプ",
  READY_MIX_CONCRETE: "生コン",
  CRUSHED_STONE: "砕石",
  SOIL_DISPOSAL: "残土処分",
  ASPHALT: "アスファルト",
  CONCRETE_PRODUCT: "コンクリート二次製品",
  BLOCK: "ブロック",
  FORMWORK: "型枠",
  SUBCONTRACT: "外注",
  OVERHEAD: "諸経費",
  OTHER: "その他",
};

export type CostBucket = "MATERIAL" | "LABOR" | "MACHINERY" | "SUBCONTRACT" | "DISPOSAL" | "OTHER";

export const COST_BUCKET_LABEL: Record<CostBucket, string> = {
  MATERIAL: "材料費",
  LABOR: "労務費",
  MACHINERY: "重機費",
  SUBCONTRACT: "外注費",
  DISPOSAL: "処分費",
  OTHER: "その他原価",
};

// 依頼元の粗利計算式(売価－材料費－労務費－重機費－外注費－処分費－その他原価＝粗利益)に
// 単価マスタの区分を割り振るための対応表。ここを直せば集計の分類だけを一元的に変更できる。
const CATEGORY_TO_BUCKET: Record<RateCategory, CostBucket> = {
  LABOR: "LABOR",
  FOREMAN_LABOR: "LABOR",
  MACHINERY: "MACHINERY",
  DUMP_TRUCK: "MACHINERY",
  READY_MIX_CONCRETE: "MATERIAL",
  CRUSHED_STONE: "MATERIAL",
  SOIL_DISPOSAL: "DISPOSAL",
  ASPHALT: "MATERIAL",
  CONCRETE_PRODUCT: "MATERIAL",
  BLOCK: "MATERIAL",
  FORMWORK: "MATERIAL",
  SUBCONTRACT: "SUBCONTRACT",
  OVERHEAD: "OTHER",
  OTHER: "OTHER",
};

export function costBucketForCategory(category: RateCategory | null | undefined): CostBucket {
  if (!category) return "OTHER";
  return CATEGORY_TO_BUCKET[category];
}
