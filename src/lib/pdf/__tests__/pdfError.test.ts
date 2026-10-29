import { describe, expect, it } from "vitest";
import { atStage, describePdfError, pdfFailureMessage, PdfRenderError } from "@/lib/pdf/pdfError";

describe("atStage", () => {
  it("成功したらそのまま値を返す", async () => {
    await expect(atStage("launch", async () => 42)).resolves.toBe(42);
  });

  it("失敗したら、どの段階で何と言われたかを持つエラーにする", async () => {
    const error = await atStage("launch", async () => {
      throw new Error("Failed to launch the browser process!\n/tmp/chromium: error while loading shared libraries");
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PdfRenderError);
    expect(error.stage).toBe("launch");
    expect(describePdfError(error)).toBe("Chromeの起動で失敗: Failed to launch the browser process!");
  });
});

describe("describePdfError", () => {
  it("段階の分からないエラーは1行目だけを返す", () => {
    expect(describePdfError(new Error("\n  タイムアウト  \n詳細"))).toBe("タイムアウト");
    expect(describePdfError("文字だけのエラー")).toBe("文字だけのエラー");
  });

  it("長すぎる文は300文字で切る", () => {
    const reason = describePdfError(new Error("あ".repeat(500)));
    expect(reason).toBe(`${"あ".repeat(300)}…`);
  });
});

describe("pdfFailureMessage", () => {
  it("今までの案内文の後ろに原因を付ける", () => {
    const message = pdfFailureMessage(new PdfRenderError("load", new Error("Navigation timeout of 30000 ms exceeded")), "「印刷 / PDF」");
    expect(message).toBe(
      "PDFの生成に失敗しました。お手数ですが「印刷 / PDF」からブラウザの印刷機能でお試しください。(原因: 印刷用画面の読み込みで失敗: Navigation timeout of 30000 ms exceeded)"
    );
  });
});
