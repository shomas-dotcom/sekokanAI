// PDF作成の失敗を、利用者の画面で原因が分かる形にする。
//
// 本番(Render)のログを見られない状況で、2回続けて推測で直して外れたため(2026-09・2026-10)、
// 「どの段階で」「何と言われて」失敗したかを画面のエラー表示にも出す。
// 出すのはChrome・部品が返した文の1行目だけ(ログイン用の情報などは含まれない)。

export type PdfStage = "prepare" | "launch" | "load" | "render";

const STAGE_LABEL: Record<PdfStage, string> = {
  prepare: "Chromeの準備(部品の展開)",
  launch: "Chromeの起動",
  load: "印刷用画面の読み込み",
  render: "PDFへの変換",
};

export class PdfRenderError extends Error {
  constructor(
    readonly stage: PdfStage,
    readonly cause: unknown
  ) {
    super(`${STAGE_LABEL[stage]}で失敗: ${firstLine(cause)}`);
    this.name = "PdfRenderError";
  }
}

/** 段階ごとに失敗を包む。 */
export async function atStage<T>(stage: PdfStage, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new PdfRenderError(stage, error);
  }
}

const MAX_REASON_LENGTH = 300;

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const line = message.split("\n").find((l) => l.trim()) ?? "原因不明";
  const trimmed = line.trim();
  return trimmed.length > MAX_REASON_LENGTH ? `${trimmed.slice(0, MAX_REASON_LENGTH)}…` : trimmed;
}

/** 画面に出す原因の一文。段階が分かればそれも入れる。 */
export function describePdfError(error: unknown): string {
  if (error instanceof PdfRenderError) return error.message;
  return firstLine(error);
}

/** PDFのダウンロード画面で返すエラー文(3種類のPDFで共通)。 */
export function pdfFailureMessage(error: unknown, printHint: string): string {
  return `PDFの生成に失敗しました。お手数ですが${printHint}からブラウザの印刷機能でお試しください。(原因: ${describePdfError(error)})`;
}
