"use client";

import { useEffect, useRef, useState } from "react";
import { accumulateSpeechResults } from "@/lib/speechRecognitionAccumulator";

// ブラウザ標準のWeb Speech API(SpeechRecognition)を利用する。
// 対応ブラウザ: Chrome/Edge/Safari(iOS/Android含む)。Firefox等は非対応のため
// フィーチャー検出で自動的にボタンを無効化する(REQUIREMENTS.md 音声入力機能)。
// サーバーへの送信は行わず、ブラウザ内の音声認識結果をテキストとして反映するのみ。

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
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

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
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
      const errorType = (event as { error?: string })?.error;
      fatalErrorRef.current = errorType === "not-allowed" || errorType === "audio-capture";
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

  if (!supported) {
    return (
      <span className="text-xs text-slate-400" title="この端末/ブラウザは音声入力に対応していません">
        音声入力非対応
      </span>
    );
  }

  if (size === "lg" || size === "xl") {
    const dimensions = size === "xl" ? "h-36 w-36 text-6xl" : "h-24 w-24 text-4xl";
    return (
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
    );
  }

  return (
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
  );
}
