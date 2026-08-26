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
