import { recordAiUsage, type AiUsageContext } from "@/lib/aiUsageLog";

// 音声の文字起こし(フォールバック)抽象化レイヤー。ブラウザの音声認識
// (SpeechRecognition)が使えない端末・ブラウザや、認識が失敗した場合に、
// 録音した音声をサーバーへ送って文字起こしする経路として用意する。
//
// 重要: Anthropic(Claude)のAPIは音声を直接文字起こしする機能を持たないため、
// 別の文字起こし専用サービス(例: OpenAI Whisper API、Google Cloud
// Speech-to-Text等)の契約が別途必要になる。CLAUDE.mdの「無料のツールだけを
// 選ぶ」方針と、外部サービスの契約・支払いは杉本さん自身の判断が必要なため、
// ここでは「どのサービスを使うか」を決め打ちにせず、環境変数
// TRANSCRIPTION_API_KEY が設定されていない間は、それらしい文字起こし結果を
// 作らず正直に「利用できません」と返す(AI_API_KEY未設定時のモック方針と同じ考え方)。
//
// 実際にサービスを契約した場合は、この関数の中身(fetch呼び出し部分)だけを
// 差し替えれば、呼び出し側(transcribeAudioAction等)は一切変更不要。

export type TranscriptionResult = {
  text: string | null;
  confidence: "high" | "unavailable";
};

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.TRANSCRIPTION_API_KEY);
}

export async function transcribeAudio(
  _audioBuffer: Buffer,
  _mimeType: string,
  usageContext?: AiUsageContext
): Promise<TranscriptionResult> {
  if (!isTranscriptionConfigured()) {
    await recordAiUsage(usageContext, {
      model: "unconfigured",
      success: false,
      errorMessage: "TRANSCRIPTION_API_KEY未設定のため文字起こしは利用できません",
    });
    return { text: null, confidence: "unavailable" };
  }

  // TODO: 文字起こしサービスを契約したら、ここにそのサービスへのfetch呼び出しを実装する。
  // (例: OpenAI Whisper APIなら multipart/form-data で音声を送り、返ってきたテキストを
  // recordAiUsageのmodelに実際のモデル名を入れて記録する)
  await recordAiUsage(usageContext, {
    model: "unconfigured",
    success: false,
    errorMessage: "文字起こしサービスの接続先が未実装です",
  });
  return { text: null, confidence: "unavailable" };
}
