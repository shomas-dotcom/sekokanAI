"use client";

import { useActionState, useRef, useState } from "react";
import { uploadProjectFileAction } from "./actions";
import { Button } from "@/components/ui";

/**
 * 過去の見積書・仕様書などを、ドラッグ&ドロップまたはファイル選択で
 * この案件に置いておくための入力欄。中身をAIが読み取ることはしない
 * (あくまで参照用の保管場所)。
 */
export function FileDropZone({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(uploadProjectFileAction, undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function submitFiles(files: FileList | null) {
    if (!files || files.length === 0 || !fileInputRef.current || !formRef.current) return;
    fileInputRef.current.files = files;
    formRef.current.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          submitFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center text-sm transition ${
          isDragOver
            ? "border-amber-500 bg-amber-50 text-amber-700"
            : "border-slate-300 text-slate-500 hover:bg-slate-50"
        }`}
      >
        <p className="font-medium">ここにファイルをドラッグ&ドロップ</p>
        <p className="text-xs">またはクリックして選択(見積書・仕様書などPDF/Excel/Word/画像、1件20MBまで)</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        name="files"
        multiple
        accept=".pdf,.xls,.xlsx,.doc,.docx,image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => submitFiles(e.target.files)}
        className="hidden"
      />
      {pending && <p className="text-xs text-slate-500">アップロード中...</p>}
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" variant="secondary" className="hidden" disabled={pending}>
        アップロード
      </Button>
    </form>
  );
}
