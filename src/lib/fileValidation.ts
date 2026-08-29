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

// 名刺・身分証等をAI(Claude)に直接読ませる画像。AnthropicのVision APIは
// HEIC/HEIFに対応していないため、写真アップロード(ALLOWED_IMAGE_MIME_TYPES)より
// 対応形式を絞る(iPhoneでHEIC設定のまま撮影された場合は、JPEG/PNGでの再選択を促す)。
export const ALLOWED_VISION_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_VISION_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB(Anthropic API側の上限に対する余裕を見た値)

export function validateVisionImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_VISION_IMAGE_MIME_TYPES.includes(file.type)) {
    return "この形式の画像は読み取れません(JPEGまたはPNGで撮影・選択してください。iPhoneの場合は「設定→カメラ→フォーマット→互換性優先」にするとJPEGで撮影できます)。";
  }
  if (file.size <= 0) {
    return "ファイルが空です。";
  }
  if (file.size > MAX_VISION_IMAGE_BYTES) {
    return "ファイルサイズが大きすぎます(10MBまで)。";
  }
  return null;
}

// 案件依頼のAI解析用(画像またはPDF)。Excel/Wordは現時点でAI解析に対応していない
// (テキストでの貼り付け・PDF・画像・音声で代替する)。
export const ALLOWED_REQUEST_ANALYSIS_MIME_TYPES = [...ALLOWED_VISION_IMAGE_MIME_TYPES, "application/pdf"];
export const MAX_REQUEST_ANALYSIS_BYTES = 15 * 1024 * 1024; // 15MB

export function validateProjectRequestFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_REQUEST_ANALYSIS_MIME_TYPES.includes(file.type)) {
    return "この形式は読み取れません(JPEG・PNG・PDFのいずれかを選択してください。Excel・Wordは今のところ非対応です。テキストとしてコピー&ペーストしてください)。";
  }
  if (file.size <= 0) {
    return "ファイルが空です。";
  }
  if (file.size > MAX_REQUEST_ANALYSIS_BYTES) {
    return "ファイルサイズが大きすぎます(15MBまで)。";
  }
  return null;
}
