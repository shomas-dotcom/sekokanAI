import sharp from "sharp";

// iPhoneは初期設定だと写真がHEIC/HEIF形式になり、Anthropicの画像認識API(Vision)は
// この形式を直接読み取れない。これまでは「JPEG/PNGで撮り直してください」という
// 案内だけを出していたが、現場の職人さんがカメラの設定を変えるのは現実的でないため、
// サーバー側でJPEGへの変換を試みる。
//
// 重要: この変換は「できれば行う」補助的な処理であり、失敗しても機能全体を止めない。
// 変換に失敗した場合はnullを返し、呼び出し側は従来どおりの
// 「読み取れませんでした」という案内にフォールバックする(嘘の成功を返さない)。
//
// 環境によってはHEIC(HEVCコーデック)のデコードに対応していないsharpビルドもあり得る
// ため、実際に効果があるかは本番環境での実機確認が必要(不明点は正直に運用者へ伝える)。
export type ConvertedImage = { buffer: Buffer; mimeType: "image/jpeg" };

export async function convertHeicToJpegIfNeeded(
  buffer: Buffer,
  mimeType: string
): Promise<ConvertedImage | null> {
  if (mimeType !== "image/heic" && mimeType !== "image/heif") return null;
  try {
    const converted = await sharp(buffer)
      // EXIFの向き情報に従って回転させたうえで、向き情報自体は焼き込んで消す
      // (回転させずにEXIFだけ残すと、EXIFを見ないビューア/AIで横向きに表示されるため)。
      .rotate()
      // 画質を極端に落とさない範囲(85)で圧縮し、大きい写真でも送信・処理が重くなりすぎないようにする。
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer: converted, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("[imageConversion] HEIC/HEIF→JPEG変換に失敗しました", err);
    return null;
  }
}
