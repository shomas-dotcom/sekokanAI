// 写真アップロードの検証ルール。SVGはスクリプトを埋め込めるため許可しない
// (image/* を丸ごと許可すると image/svg+xml も通ってしまいXSSの糸口になる)。
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB(スマホ写真1枚を想定した上限)

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return "対応していないファイル形式です(JPEG・PNG・WEBP・HEICのいずれかを選択してください)。";
  }
  if (file.size <= 0) {
    return "ファイルが空です。";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "ファイルサイズが大きすぎます(8MBまで)。";
  }
  return null;
}

// 過去の見積書・仕様書等の参考資料アップロード用。写真より緩いが、実行可能な
// ファイル(実行ファイル・スクリプト・SVG)は許可しない(XSS・マルウェアの糸口になるため)。
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ...ALLOWED_IMAGE_MIME_TYPES,
];
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20MB(見積書PDF・写真つきExcel等を想定した上限)

export function validateDocumentFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return "対応していないファイル形式です(PDF・Excel・Word・画像のいずれかを選択してください)。";
  }
  if (file.size <= 0) {
    return "ファイルが空です。";
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "ファイルサイズが大きすぎます(20MBまで)。";
  }
  return null;
}
