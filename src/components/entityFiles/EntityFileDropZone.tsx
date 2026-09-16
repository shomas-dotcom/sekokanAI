"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  // 選択したファイル名を、送信中〜結果が出るまで画面に出す(「押したのに何も
  // 起きていないように見える」という不安をなくすため)。
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const prevPendingRef = useRef(pending);

  function submitFiles(files: FileList | null) {
    if (!files || files.length === 0 || !fileInputRef.current || !formRef.current) return;
    setSelectedNames(Array.from(files).map((f) => f.name));
    fileInputRef.current.files = files;
    formRef.current.requestSubmit();
  }

  // 送信中(pending)がtrue→falseになった瞬間=処理が終わった瞬間を捉えて、
  // 同じファイルをもう一度選び直せるようinput自体をリセットする。
  // (成功時はactionがundefinedを返すため、stateの値だけでは「完了した」ことを
  // 判定できない。pendingの変化で判定する。)成功時はファイル名の表示も消す
  // (失敗時は原因がわかるよう残しておく)。
  useEffect(() => {
    if (prevPendingRef.current && !pending) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      // 送信完了(pendingのtrue→false)検知後の後始末で、直前のDOMリセットと対になっているため意図的。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!state?.error) setSelectedNames([]);
    }
    prevPendingRef.current = pending;
  }, [pending, state]);

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
        <p className="text-xs">またはクリックして選択(PDF/Excel/CSV/Word/画像、1件20MBまで)</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        name="files"
        multiple
        accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(e) => submitFiles(e.target.files)}
        className="hidden"
      />
      {selectedNames.length > 0 && (
        <ul className="text-xs text-slate-500">
          {selectedNames.map((name) => (
            <li key={name}>📄 {name}</li>
          ))}
        </ul>
      )}
      {pending && <p className="text-xs text-slate-500">アップロード中...</p>}
      {state?.error && <p className="text-sm text-rose-700">{state.error}</p>}
      <Button type="submit" variant="secondary" className="hidden" disabled={pending}>
        アップロード
      </Button>
    </form>
  );
}
