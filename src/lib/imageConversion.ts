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

// 最近のiPhoneは1枚あたり12〜48メガピクセル(長辺4000〜8000px超)の写真を撮る。
// AI(Vision)にはそこまでの解像度は不要な一方、サーバー側でそのまま抱えると
// メモリ使用量・通信量・処理時間が無駄に大きくなる(本番はRenderの無料枠=メモリの
// 少ないインスタンスで動いているため、これが「ページを読み込めませんでした」という
// 接続断・タイムアウトの一因になっている可能性がある)。
// そのため、HEIC変換に加えて「長辺が一定以上なら縮小する」処理をここに集約する。
const MAX_VISION_IMAGE_DIMENSION = 2000; // px。この程度でもAIの読み取り精度への影響は小さい

/**
 * AI(Vision)へ渡す直前の画像を、①HEIC/HEIFならJPEGへ変換し、②大きすぎる場合は
 * 縮小する。どちらの処理も失敗した場合は例外を投げず、可能な範囲(元のバッファ)を
 * 返す — 呼び出し側の検証(validateVisionImageFile等)にそのまま進ませ、
 * 最終的には既存の「読み取れませんでした」という案内にフォールバックさせるため。
 *
 * 保存用(EntityFile・ProjectFile・DailyReportPhoto等)の画像はここを通さない
 * (現場の記録用に、選んだ写真をそのまま保存する)。
 */
export async function prepareImageForVision(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  let workingBuffer = buffer;
  let workingType = mimeType;

  if (mimeType === "image/heic" || mimeType === "image/heif") {
    const converted = await convertHeicToJpegIfNeeded(buffer, mimeType);
    if (!converted) return { buffer, mimeType }; // 変換不可。元のまま返し既存の案内に委ねる
    workingBuffer = converted.buffer;
    workingType = converted.mimeType;
  }

  try {
    const metadata = await sharp(workingBuffer).metadata();
    const longSide = Math.max(metadata.width ?? 0, metadata.height ?? 0);
    if (longSide > MAX_VISION_IMAGE_DIMENSION) {
      const resized = await sharp(workingBuffer)
        .rotate()
        .resize({
          width: MAX_VISION_IMAGE_DIMENSION,
          height: MAX_VISION_IMAGE_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
      return { buffer: resized, mimeType: "image/jpeg" };
    }
  } catch (err) {
    // 縮小に失敗しても致命的にはしない。元のサイズのまま後続の処理へ進める
    // (これまでどおりの動作に留まるだけで、新たに壊れるわけではない)。
    console.error("[imageConversion] 画像の縮小をスキップしました", err);
  }

  return { buffer: workingBuffer, mimeType: workingType };
}

/**
 * 保存用(EntityFile・ProjectFile・DailyReportPhoto等)にHEIC/HEIFをJPEGへ変換する。
 * iPhoneで撮ったHEIC写真は、Android・Windows・Chrome等の他の端末のブラウザでは
 * 表示できないことが多く、「会社内で共有したのに開けない」原因になる。
 * 解像度はprepareImageForVisionと違って縮小しない(現場記録として保存する写真の
 * 画質はそのまま残す)。変換に失敗した場合は元のファイルのまま返す(保存自体は止めない)。
 */
export async function prepareImageForStorage(buffer: Buffer<ArrayBuffer>, mimeType: string, fileName: string) {
  const converted = await convertHeicToJpegIfNeeded(buffer, mimeType);
  if (!converted) return { buffer, mimeType, fileName };
  // convertHeicToJpegIfNeededが返すバッファはsharp由来でBuffer<ArrayBufferLike>型になるため、
  // DBのバイナリ列(Prisma)が要求するBuffer<ArrayBuffer>へ詰め直す。
  const arrayBuffer = new ArrayBuffer(converted.buffer.byteLength);
  new Uint8Array(arrayBuffer).set(converted.buffer);
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: converted.mimeType,
    fileName: fileName.replace(/\.(heic|heif)$/i, ".jpg"),
  };
}
