"use server";

import { requireUser } from "@/lib/auth";
import { validateAudioFile } from "@/lib/fileValidation";
import { transcribeAudio } from "@/lib/transcription";

export type TranscribeAudioState = { text?: string; error?: string };

/**
 * 録音フォールバック用の共通アクション。ブラウザの音声認識(SpeechRecognition)が
 * 使えない/失敗した場合に、MediaRecorderで録音した音声をここへ送って文字起こしする。
 * どの画面のマイクボタンからでも呼べるよう、特定の機能に依存しない汎用アクションにする。
 * 録音データは文字起こしにのみ使い、保存はしない(身分証OCRの画像と同じ方針)。
 */
export async function transcribeAudioAction(formData: FormData): Promise<TranscribeAudioState> {
  const user = await requireUser();
  const file = formData.get("audio");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "録音データがありません。もう一度録音してください。" };
  }
  const validationError = validateAudioFile(file);
  if (validationError) return { error: validationError };

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await transcribeAudio(buffer, file.type, {
    companyId: user.companyId,
    userId: user.id,
    feature: "voice.transcribeFallback",
  });

  if (result.confidence === "unavailable" || !result.text) {
    return {
      error:
        "録音はできましたが、文字起こしサービスが現在設定されていません。お手数ですが、テキストを直接入力してください。",
    };
  }

  return { text: result.text };
}
