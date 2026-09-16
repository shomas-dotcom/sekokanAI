import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { convertHeicToJpegIfNeeded } from "@/lib/imageConversion";

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
