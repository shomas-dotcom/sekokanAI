import { describe, expect, it } from "vitest";
import { validateImageFile, validateAudioFile, MAX_IMAGE_BYTES, MAX_AUDIO_BYTES } from "@/lib/fileValidation";

describe("validateImageFile", () => {
  it("許可された画像形式は通す", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("SVG等スクリプトを含み得る形式は拒否する(XSS対策)", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 1000 })).not.toBeNull();
  });

  it("画像以外のファイルは拒否する", () => {
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).not.toBeNull();
  });

  it("空のファイルは拒否する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 0 })).not.toBeNull();
  });

  it("上限サイズを超えるファイルは拒否する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).not.toBeNull();
  });

  it("上限サイズちょうどは許可する", () => {
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBeNull();
  });
});

describe("validateAudioFile", () => {
  it("iPhone Safari(audio/mp4)・Chrome(audio/webm)いずれの録音形式も通す", () => {
    expect(validateAudioFile({ type: "audio/mp4", size: 1000 })).toBeNull();
    expect(validateAudioFile({ type: "audio/webm", size: 1000 })).toBeNull();
  });

  it("MediaRecorderが付与するcodecs指定(例: audio/webm;codecs=opus)も前方一致で通す", () => {
    expect(validateAudioFile({ type: "audio/webm;codecs=opus", size: 1000 })).toBeNull();
  });

  it("音声以外の形式は拒否する", () => {
    expect(validateAudioFile({ type: "image/jpeg", size: 1000 })).not.toBeNull();
  });

  it("空の録音データは拒否する", () => {
    expect(validateAudioFile({ type: "audio/mp4", size: 0 })).not.toBeNull();
  });

  it("上限サイズを超える録音は拒否する", () => {
    expect(validateAudioFile({ type: "audio/mp4", size: MAX_AUDIO_BYTES + 1 })).not.toBeNull();
  });
});
