// AI抽象化レイヤー。AI_API_KEY未設定時はモック実装で動作する(ARCHITECTURE.md参照)。
// 特定ベンダーへの依存を避けるため、呼び出し側はこのモジュールの関数のみを利用する。

export type DraftQuoteItem = {
  itemName: string;
  spec: string | null;
  quantity: number;
  unit: string;
  unitPriceHint: number | null; // 参考値。確定単価としては使わない(REQUIREMENTS.md)
};

const isMockMode = () => !process.env.AI_API_KEY;

/**
 * 自由記述の工事内容テキストから見積項目の下書きを作成する。
 * 単価は確定させず、常に priceSource=AI_ESTIMATE(参考値)として扱うこと。
 */
export async function draftQuoteItemsFromText(freeText: string): Promise<DraftQuoteItem[]> {
  if (isMockMode()) {
    return mockDraftQuoteItems(freeText);
  }
  // AI_API_KEY設定後にここへ実際のAI呼び出しを実装する。
  return mockDraftQuoteItems(freeText);
}

function mockDraftQuoteItems(freeText: string): DraftQuoteItem[] {
  return freeText
    .split(/\r?\n|、|,/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      itemName: line,
      spec: null,
      quantity: 1,
      unit: "式",
      unitPriceHint: null,
    }));
}
