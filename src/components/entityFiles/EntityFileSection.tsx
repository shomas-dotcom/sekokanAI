import { deleteEntityFileAction } from "@/lib/entityFileActions";
import { EntityFileDropZone } from "./EntityFileDropZone";
import type { FileEntityType } from "@/generated/prisma/enums";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export type EntityFileListItem = {
  id: string;
  fileName: string;
  size: number;
  createdAt: Date;
};

export function EntityFileSection({
  entityType,
  entityId,
  files,
}: {
  entityType: FileEntityType;
  entityId: string;
  files: EntityFileListItem[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">
        関連する見積書・仕様書・書類などを置いておく場所です。中身をAIが読み取ることはありません。
      </p>
      <EntityFileDropZone entityType={entityType} entityId={entityId} />
      {files.length === 0 ? (
        <p className="text-sm text-slate-400">まだファイルがありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <a
                href={`/files/entity/${entityType}/${entityId}/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-slate-700 underline"
              >
                {file.fileName}
              </a>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                <span className="text-xs text-slate-400">{file.createdAt.toLocaleDateString("ja-JP")}</span>
                <form action={deleteEntityFileAction}>
                  <input type="hidden" name="id" value={file.id} />
                  <input type="hidden" name="entityType" value={entityType} />
                  <input type="hidden" name="entityId" value={entityId} />
                  <button type="submit" className="text-xs text-rose-600 underline">
                    削除
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
