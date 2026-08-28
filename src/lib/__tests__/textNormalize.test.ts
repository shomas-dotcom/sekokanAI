import { describe, expect, it } from "vitest";
import { normalizeExtractedText } from "@/lib/textNormalize";

describe("normalizeExtractedText", () => {
  it("全角英数字を半角に揃える", () => {
    expect(normalizeExtractedText("Ａ１２３")).toBe("A123");
  });

  it("丸数字を通常の数字に展開する(①②③)", () => {
    expect(normalizeExtractedText("①掘削工②残土処分")).toBe("1掘削工2残土処分");
  });

  it("㎡ / m² を m2 に揃える", () => {
    expect(normalizeExtractedText("土間コン30㎡、施工面積30m²")).toBe("土間コン30m2、施工面積30m2");
  });

  it("㎥ を m3 に揃える", () => {
    expect(normalizeExtractedText("残土10㎥")).toBe("残土10m3");
  });

  it("改行コードの揺れを統一し、3行以上続く空行は詰める", () => {
    expect(normalizeExtractedText("行1\r\n\r\n\r\n行2\r行3")).toBe("行1\n\n行2\n行3");
  });

  it("行末の余分な空白を除去する", () => {
    expect(normalizeExtractedText("行1   \n行2\t\t")).toBe("行1\n行2");
  });

  it("空文字はそのまま返す", () => {
    expect(normalizeExtractedText("")).toBe("");
  });
});
