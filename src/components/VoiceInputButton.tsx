"use client";

import { useEffect, useRef, useState } from "react";
import { accumulateSpeechResults } from "@/lib/speechRecognitionAccumulator";
import { transcribeAudioAction } from "@/lib/transcribeAudioAction";

// ブラウザ標準のWeb Speech API(SpeechRecognition)を利用する。
// 対応ブラウザ: Chrome/Edge/Safari(iOS/Android含む)。Firefox等は非対応のため
// フィーチャー検出で自動的にボタンを無効化する(REQUIREMENTS.md 音声入力機能)。
// サーバーへの送信は行わず、ブラウザ内の音声認識結果をテキストとして反映するのみ。
//
// ただしiPhone Safariは、長い発話(continuous)だと数十秒で認識が途切れたり、
// そもそも音声認識に対応していないブラウザ(アプリ内ブラウザ等)もある。
// continuous(長文入力)モードに限り、「録音してサーバーで文字起こしする」
// フォールバックを併設する(MediaRecorder→サーバーへ送信→文字起こし)。
// フォールバックの文字起こし自体は外部サービスの契約が必要なため、未契約の間は
// 「録音はできるが文字起こしは利用できません」と正直に案内する(src/lib/transcription.ts参照)。

type SpeechRecognitionResultEvent = {
  results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
};
type SpeechRecognitionErrorEvent = { error?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

function isMediaRecorderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

// MediaRecorderが生成する音声形式は端末によって異なる。iPhone SafariはWebMを
// 録音できないため、対応形式を順に試す。
const PREFERRED_RECORDING_MIME_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return PREFERRED_RECORDING_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function VoiceInputButton({
  targetRef,
  mode = "replace",
  continuous = false,
  onTranscript,
  size = "sm",
  className,
}: {
  targetRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  mode?: "replace" | "append";
  /** trueの場合、停止するまで話した内容を蓄積し続ける(日報など長い発話向け) */
  continuous?: boolean;
  onTranscript?: (text: string) => void;
  /** xlは「話して記録する」ページ専用の特大サイズ(ベテラン・年配の方でも押しやすいように) */
  size?: "sm" | "lg" | "xl";
  className?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState(false);
  const [fallbackRecording, setFallbackRecording] = useState(false);
  const [fallbackPending, setFallbackPending] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  // ブラウザ(特にChrome/iOS Safari)は無音が続くと数十秒〜1分程度で自動的に
  // 音声認識を終了させてしまう。停止ボタンを押すまで話し続けられるように、
  // 「利用者が意図的に止めたか」をこのrefで管理し、意図しない終了(=このrefがtrueのまま
  // onendが呼ばれた)場合は自動で再開する。
  const wantsListeningRef = useRef(false);
  // 権限拒否・マイク無し等、再開しても無駄なエラーの場合は自動再開しない
  const fatalErrorRef = useRef(false);
  // event.results は同じ認識セッション内では過去の確定分も含めた累積配列で
  // 毎回渡されてくる。このrefで「すでにbaseTextRefへ取り込んだ確定件数」を
  // 覚えておき、まだ取り込んでいない新しい確定分だけを追記する
  // (でないと確定するたびに全文を重複して追記してしまう=「同じ内容が何行も
  // 増える」不具合になる)。新しい認識セッションを開始するたびに0へ戻す。
  const committedFinalCountRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // window/navigatorに依存する機能判定のため、サーバー側では判定できない。
    // ここで意図的に「サポートあり」を初期値としてSSRと初回描画を一致させ、
    // マウント後に実際の値へ更新する(ハイドレーション不整合を避けるため)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechRecognitionCtor() !== null);
    setMediaRecorderSupported(isMediaRecorderSupported());
  }, []);

  function applyTranscript(text: string, isFinalChunk: boolean) {
    if (onTranscript) onTranscript(text);
    const el = targetRef?.current;
    if (!el) return;

    if (continuous) {
      // baseTextRefは録音開始時点の既存テキスト。認識結果はその後ろに随時追記する。
      const combined = baseTextRef.current ? `${baseTextRef.current}\n${text}` : text;
      el.value = combined;
      if (isFinalChunk) baseTextRef.current = combined;
    } else if (mode === "append") {
      const existing = el.value.trim();
      el.value = existing ? `${existing}\n${text}` : text;
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function startRecognition() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = continuous;
    recognition.interimResults = continuous;
    committedFinalCountRef.current = 0; // 新しいセッションなのでresults配列の番号は0から数え直しになる
    recognition.onresult = (event) => {
      if (continuous) {
        const results: { isFinal: boolean; transcript: string }[] = [];
        for (let i = 0; i < event.results.length; i++) {
          results.push({ isFinal: event.results[i].isFinal, transcript: event.results[i][0].transcript });
        }
        const { newFinalText, interimText, finalCount } = accumulateSpeechResults(
          results,
          committedFinalCountRef.current
        );
        committedFinalCountRef.current = finalCount;
        applyTranscript((newFinalText + interimText).trim(), false);
        if (newFinalText) baseTextRef.current = baseTextRef.current
          ? `${baseTextRef.current}\n${newFinalText.trim()}`
          : newFinalText.trim();
      } else {
        const text = event.results[0]?.[0]?.transcript ?? "";
        if (text) applyTranscript(text, true);
      }
    };
    recognition.onerror = (event) => {
      // "no-speech"(無音が続いただけ)は再開すればよいので致命的エラー扱いにしない
      fatalErrorRef.current = event.error === "not-allowed" || event.error === "audio-capture";
    };
    recognition.onend = () => {
      if (continuous && wantsListeningRef.current && !fatalErrorRef.current) {
        // 利用者はまだ話し続けるつもりなのに、ブラウザ側の都合で切れただけ。
        // 気付かれないよう即座に新しい認識セッションを開始する(蓄積済みのテキストは維持)。
        startRecognition();
        return;
      }
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function toggle() {
    if (listening) {
      // 利用者が明示的に停止ボタンを押した場合のみ、本当に終了させる
      wantsListeningRef.current = false;
      recognitionRef.current?.stop();
      return;
    }
    if (!getSpeechRecognitionCtor()) {
      setSupported(false);
      return;
    }
    baseTextRef.current = targetRef?.current?.value ?? "";
    wantsListeningRef.current = true;
    fatalErrorRef.current = false;
    startRecognition();
  }

  // --- 録音フォールバック(MediaRecorder→サーバーで文字起こし) -------------------

  async function startFallbackRecording() {
    setFallbackError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        await sendRecordingForTranscription(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setFallbackRecording(true);
    } catch (err) {
      console.error("[VoiceInputButton] failed to start recording", err);
      setFallbackError("マイクを使えませんでした。ブラウザのマイク許可設定をご確認ください。");
    }
  }

  function stopFallbackRecording() {
    mediaRecorderRef.current?.stop();
    setFallbackRecording(false);
  }

  async function sendRecordingForTranscription(blob: Blob) {
    if (blob.size === 0) {
      setFallbackError("録音できませんでした。もう一度お試しください。");
      return;
    }
    setFallbackPending(true);
    try {
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fd = new FormData();
      fd.set("audio", blob, `recording.${extension}`);
      const result = await transcribeAudioAction(fd);
      if (result.error) {
        setFallbackError(result.error);
        return;
      }
      if (result.text) applyTranscript(result.text, true);
    } catch (err) {
      console.error("[VoiceInputButton] failed to send recording", err);
      setFallbackError("送信に失敗しました。通信状態を確認してもう一度お試しください。");
    } finally {
      setFallbackPending(false);
    }
  }

  // continuous(長文入力)モードのみ、録音フォールバックの案内を併設する。
  // 短い1回入力の小さいマイクボタン(顧客名等の単項目)では出さない
  // (常時表示すると画面が煩雑になるため、認識が長く続かない現場ではフォールバックの
  // 価値が高いcontinuousモードに絞る)。
  const fallbackSection = continuous && mediaRecorderSupported && (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={fallbackRecording ? stopFallbackRecording : startFallbackRecording}
        disabled={fallbackPending}
        className={`text-xs font-medium underline decoration-dotted underline-offset-2 disabled:opacity-50 ${
          fallbackRecording ? "text-rose-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        {fallbackPending
          ? "文字にしています..."
          : fallbackRecording
            ? "⏹ 録音を止めて送信する"
            : "うまく聞き取れない場合はこちら(録音して送信)"}
      </button>
      {fallbackError && (
        <p className="max-w-[240px] text-center text-xs text-rose-600">{fallbackError}</p>
      )}
    </div>
  );

  if (!supported) {
    if (continuous && mediaRecorderSupported) {
      // 音声認識自体が使えない端末・ブラウザでは、録音フォールバックを主手段として提示する。
      return (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={fallbackRecording ? stopFallbackRecording : startFallbackRecording}
            disabled={fallbackPending}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              fallbackRecording
                ? "bg-gradient-to-br from-rose-500 to-orange-500 animate-pulse"
                : "bg-gradient-to-br from-indigo-600 to-violet-600"
            }`}
          >
            🎙️ {fallbackPending ? "文字にしています..." : fallbackRecording ? "録音を止めて送信" : "録音して文字にする"}
          </button>
          <p className="text-xs text-slate-400">この端末は音声入力(自動)には対応していません</p>
          {fallbackError && (
            <p className="max-w-[240px] text-center text-xs text-rose-600">{fallbackError}</p>
          )}
        </div>
      );
    }
    return (
      <span className="text-xs text-slate-400" title="この端末/ブラウザは音声入力に対応していません">
        音声入力非対応
      </span>
    );
  }

  if (size === "lg" || size === "xl") {
    const dimensions = size === "xl" ? "h-36 w-36 text-6xl" : "h-24 w-24 text-4xl";
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={
            className ??
            `flex ${dimensions} items-center justify-center rounded-full shadow-lg transition ${
              listening
                ? "bg-gradient-to-br from-rose-500 to-orange-500 animate-pulse text-white shadow-rose-500/40"
                : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-600/40 hover:scale-105"
            }`
          }
          aria-label={listening ? "録音停止" : "音声入力開始"}
        >
          🎤
        </button>
        {fallbackSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        className={
          className ??
          `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            listening
              ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
              : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100"
          }`
        }
      >
        <span className={listening ? "animate-pulse" : ""}>🎤</span>
        {listening ? "認識中... (タップで停止)" : "音声入力"}
      </button>
      {fallbackSection}
    </div>
  );
}
