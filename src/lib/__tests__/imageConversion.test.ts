import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { convertHeicToJpegIfNeeded, prepareImageForVision } from "@/lib/imageConversion";

describe("convertHeicToJpegIfNeeded", () => {
  it("HEIC/HEIF以外の形式はそのままnullを返す(変換を試みない)", async () => {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    expect(await convertHeicToJpegIfNeeded(jpeg, "image/jpeg")).toBeNull();
    expect(await convertHeicToJpegIfNeeded(jpeg, "application/pdf")).toBeNull();
  });

  it("HEIF形式の画像をJPEGへ変換できる場合はJPEGバッファを返す", async () => {
    // 実機のiPhoneが作るHEIC(HEVCコーデック)そのものではなく、このsharpビルドが
    // 対応しているHEIFコンテナ(AV1コーデック)で代用した往復テスト。
    // 実際のiPhone写真での動作は、本番環境での実機確認が別途必要(README/報告参照)。
    const heif = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 200, g: 50, b: 50 } },
    })
      .heif({ compression: "av1" })
      .toBuffer();

    const result = await convertHeicToJpegIfNeeded(heif, "image/heic");
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe("image/jpeg");

    const metadata = await sharp(result!.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
  });

  it("壊れたデータ等で変換に失敗した場合は例外を投げずnullを返す", async () => {
    const brokenBuffer = Buffer.from("これはHEICファイルではありません");
    const result = await convertHeicToJpegIfNeeded(brokenBuffer, "image/heic");
    expect(result).toBeNull();
  });
});

describe("prepareImageForVision", () => {
  it("小さい画像はそのまま(形式・サイズを変えない)", async () => {
    const small = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const result = await prepareImageForVision(small, "image/png");
    expect(result.mimeType).toBe("image/png");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(100);
  });

  it("長辺が大きすぎる画像はAI送信前に縮小する(メモリ・通信量対策)", async () => {
    // 最近のiPhoneが撮る写真を想定した大きめのサイズ(長辺3000px)。
    const big = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const result = await prepareImageForVision(big, "image/jpeg");
    const metadata = await sharp(result.buffer).metadata();
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(2000);
    // 縦横比は維持される(3000x2000 → 2000x1333程度)
    expect(metadata.width).toBe(2000);
  });

  it("HEIF画像が大きい場合、変換と縮小の両方が行われる", async () => {
    const bigHeif = await sharp({
      create: { width: 2500, height: 2500, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .heif({ compression: "av1" })
      .toBuffer();

    const result = await prepareImageForVision(bigHeif, "image/heic");
    expect(result.mimeType).toBe("image/jpeg");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(2000);
  });
});
