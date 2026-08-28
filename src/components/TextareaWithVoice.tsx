"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui";
import { VoiceInputButton } from "@/components/VoiceInputButton";

/**
 * 既存のTextareaに音声入力ボタンを添えただけのラッパー。見積・契約書・請求書の
 * 備考・特約事項等、AIによる項目分解を必要としない単純な自由記述欄向け
 * (複数項目へ振り分けたい場合はVoiceFormFillerを使う)。
 */
export function TextareaWithVoice({
  name,
  rows,
  defaultValue,
  disabled,
  placeholder,
}: {
  name: string;
  rows?: number;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col gap-1">
      {!disabled && (
        <div className="flex justify-end">
          <VoiceInputButton targetRef={ref} mode="append" />
        </div>
      )}
      <Textarea
        ref={ref}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
