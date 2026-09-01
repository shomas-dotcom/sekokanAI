import { describe, expect, it } from "vitest";
import { accumulateSpeechResults } from "@/lib/speechRecognitionAccumulator";

describe("accumulateSpeechResults", () => {
  it("初回は確定分をそのまま新規テキストとして返す", () => {
    const result = accumulateSpeechResults([{ isFinal: true, transcript: "今日は現場に行きました。" }], 0);
    expect(result.newFinalText).toBe("今日は現場に行きました。");
    expect(result.finalCount).toBe(1);
  });

  it("同じセッション内で2回目に確定が増えても、新しく確定した分だけを返す(重複しない)", () => {
    // 1回目のonresult: 1件確定
    const first = accumulateSpeechResults(
      [{ isFinal: true, transcript: "今日は現場に行きました。" }],
      0
    );
    expect(first.newFinalText).toBe("今日は現場に行きました。");

    // 2回目のonresult: ブラウザは累積結果を渡してくる(1件目はそのまま、2件目が新規に確定)
    const second = accumulateSpeechResults(
      [
        { isFinal: true, transcript: "今日は現場に行きました。" },
        { isFinal: true, transcript: "作業員は4名でした。" },
      ],
      first.finalCount
    );
    // 1件目を重複して含めない(これが直したバグ: 以前は毎回全確定分を追記していた)
    expect(second.newFinalText).toBe("作業員は4名でした。");
    expect(second.finalCount).toBe(2);
  });

  it("確定していない暫定テキストは新規確定テキストに含めない", () => {
    const result = accumulateSpeechResults(
      [
        { isFinal: true, transcript: "今日は現場に行きました。" },
        { isFinal: false, transcript: "作業員は" },
      ],
      0
    );
    expect(result.newFinalText).toBe("今日は現場に行きました。");
    expect(result.interimText).toBe("作業員は");
  });

  it("確定が増えていない(暫定のみ更新された)呼び出しでは新規確定テキストは空", () => {
    const first = accumulateSpeechResults([{ isFinal: true, transcript: "今日は現場に行きました。" }], 0);
    const second = accumulateSpeechResults(
      [
        { isFinal: true, transcript: "今日は現場に行きました。" },
        { isFinal: false, transcript: "作業員は" },
      ],
      first.finalCount
    );
    expect(second.newFinalText).toBe("");
    expect(second.interimText).toBe("作業員は");
    expect(second.finalCount).toBe(1);
  });
});
