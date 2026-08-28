"use client";

import { useActionState, useRef, useState } from "react";
import { uploadEntityFileAction } from "@/lib/entityFileActions";
import { Button } from "@/components/ui";
import type { FileEntityType } from "@/generated/prisma/enums";

/**
 * 顧客・見積・契約書・請求書・従業員の各詳細画面「ファイル参照」タブ共通の
 * ドラッグ&ドロップ入力欄。中身をAIが読み取ることはしない(参照用の保管場所)。
 */
export function EntityFileDropZone({
  entityType,
  entityId,
}: {
  entityType: FileEntityType;
  entityId: string;
}) {
  const [state, formAction, pending] = useActionState(uploadEntityFileAction, undefined);
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
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
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
        <p className="text-xs">またはクリックして選択(PDF/Excel/Word/画像、1件20MBまで)</p>
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
