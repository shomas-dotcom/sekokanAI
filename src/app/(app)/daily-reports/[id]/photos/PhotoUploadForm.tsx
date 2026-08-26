"use client";

import { useActionState, useRef, useState } from "react";
import { uploadPhotoAction } from "./actions";
import { Button } from "@/components/ui";

const PHASE_LABELS: Record<string, string> = {
  BEFORE: "施工前",
  DURING: "施工中",
  AFTER: "施工後",
};

/**
 * 写真アップロードフォーム。EXIFのDateTimeOriginalをクライアント側(exifr)で抽出し、
 * hidden inputで渡す(取得できなければサーバー側でアップロード時刻にフォールバックする)。
 * 施工前/中/後はAI自動判定ではなく手動選択(既存写真の枚数から初期値のみ提案する)。
 */
export function PhotoUploadForm({
  dailyReportId,
  existingPhotoCount,
}: {
  dailyReportId: string;
  existingPhotoCount: number;
}) {
  const [state, formAction, pending] = useActionState(uploadPhotoAction, undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const takenAtRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const defaultPhase = existingPhotoCount === 0 ? "BEFORE" : "DURING";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));

    try {
      const exifr = (await import("exifr")).default;
      const data = await exifr.parse(file, ["DateTimeOriginal"]);
      if (takenAtRef.current && data?.DateTimeOriginal instanceof Date) {
        takenAtRef.current.value = data.DateTimeOriginal.toISOString();
      }
    } catch {
      // EXIFが取得できない画像もあるため、失敗時は何もしない(アップロード時刻にフォールバック)
    }
  }

  return (
    <form
      action={(formData) => {
        formAction(formData);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }}
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 p-4"
    >
      <input type="hidden" name="dailyReportId" value={dailyReportId} />
      <input type="hidden" name="takenAt" ref={takenAtRef} />

      <label className="text-sm font-medium text-slate-700">写真を追加</label>
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="text-sm"
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="プレビュー" className="h-32 w-32 rounded-lg object-cover" />
      )}

      <div className="flex gap-3 text-sm">
        {(["BEFORE", "DURING", "AFTER"] as const).map((phase) => (
          <label key={phase} className="flex items-center gap-1.5">
            <input type="radio" name="phase" value={phase} defaultChecked={phase === defaultPhase} />
            {PHASE_LABELS[phase]}
          </label>
        ))}
      </div>

      <input
        type="text"
        name="caption"
        placeholder="コメント(任意)"
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />

      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "アップロード中..." : "写真を追加"}
      </Button>
    </form>
  );
}
