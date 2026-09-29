// PDFダウンロードのファイル名まわりの共通処理。
// Windows/macOSで使えない文字(\/:*?"<>|と制御文字)を除去・置換し、
// 日本語のファイル名でも文字化けせずダウンロードできるようにする(RFC 6266)。

const UNSAFE_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** ファイル名の一部として使えるように、使用できない文字を全角スペース等に置き換える。 */
export function sanitizeFilenameComponent(text: string): string {
  return text.replace(UNSAFE_FILENAME_CHARS, "_").trim();
}

/**
 * 日本語を含むファイル名を安全にダウンロードさせるためのContent-Dispositionヘッダー値を作る。
 * filename(ASCIIのみの代替名)とfilename*(UTF-8、RFC 6266)の両方を入れることで、
 * 対応していないクライアントでは代替名、対応しているブラウザでは正しい日本語名が使われる。
 */
export function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
