import { afterEach, describe, expect, it } from "vitest";
import { isTranscriptionConfigured, transcribeAudio } from "@/lib/transcription";

describe("transcription (文字起こしフォールバック)", () => {
  const originalKey = process.env.TRANSCRIPTION_API_KEY;

  afterEach(() => {
    process.env.TRANSCRIPTION_API_KEY = originalKey;
  });

  it("TRANSCRIPTION_API_KEY未設定時はisTranscriptionConfiguredがfalseを返す", () => {
    delete process.env.TRANSCRIPTION_API_KEY;
    expect(isTranscriptionConfigured()).toBe(false);
  });

  it("TRANSCRIPTION_API_KEY未設定時、それらしい文字起こし結果を作らずunavailableを返す", async () => {
    delete process.env.TRANSCRIPTION_API_KEY;
    const result = await transcribeAudio(Buffer.from("dummy"), "audio/mp4");
    expect(result.confidence).toBe("unavailable");
    expect(result.text).toBeNull();
  });
});
