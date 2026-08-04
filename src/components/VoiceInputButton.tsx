"use client";

import { useEffect, useRef, useState } from "react";

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
  size?: "sm" | "lg";
  className?: string;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");

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

  function toggle() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    baseTextRef.current = targetRef?.current?.value ?? "";
    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = continuous;
    recognition.interimResults = continuous;
    recognition.onresult = (event) => {
      if (continuous) {
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        applyTranscript((finalText + interimText).trim(), false);
        if (finalText) baseTextRef.current = baseTextRef.current
          ? `${baseTextRef.current}\n${finalText.trim()}`
          : finalText.trim();
      } else {
        const text = event.results[0]?.[0]?.transcript ?? "";
        if (text) applyTranscript(text, true);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  if (!supported) {
    return (
      <span className="text-xs text-slate-400" title="この端末/ブラウザは音声入力に対応していません">
        音声入力非対応
      </span>
    );
  }

  if (size === "lg") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={
          className ??
          `flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition ${
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
