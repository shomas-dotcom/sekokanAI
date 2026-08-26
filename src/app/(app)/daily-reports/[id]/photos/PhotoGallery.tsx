import { deletePhotoAction, updatePhotoPhaseAction } from "./actions";
import { Badge } from "@/components/ui";

const PHASE_LABELS: Record<string, string> = {
  BEFORE: "施工前",
  DURING: "施工中",
  AFTER: "施工後",
  UNKNOWN: "未分類",
};

type Photo = {
  id: string;
  dailyReportId: string;
  phase: string;
  caption: string | null;
  takenAt: Date | null;
};

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) {
    return <p className="text-sm text-slate-400">まだ写真がありません。</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((photo) => (
        <div key={photo.id} className="flex flex-col gap-1.5 rounded-xl border border-slate-200 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/daily-reports/${photo.dailyReportId}/photos/${photo.id}`}
            alt={photo.caption ?? "現場写真"}
            className="aspect-square w-full rounded-lg object-cover"
          />
          <Badge className="w-fit">{PHASE_LABELS[photo.phase] ?? photo.phase}</Badge>
          {photo.takenAt && (
            <p className="text-[11px] text-slate-400">{new Date(photo.takenAt).toLocaleString("ja-JP")}</p>
          )}
          {photo.caption && <p className="text-xs text-slate-600">{photo.caption}</p>}

          <form action={updatePhotoPhaseAction} className="flex gap-1">
            <input type="hidden" name="id" value={photo.id} />
            <input type="hidden" name="dailyReportId" value={photo.dailyReportId} />
            {(["BEFORE", "DURING", "AFTER"] as const).map((phase) => (
              <button
                key={phase}
                type="submit"
                name="phase"
                value={phase}
                className={
                  photo.phase === phase
                    ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                    : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200"
                }
              >
                {PHASE_LABELS[phase]}
              </button>
            ))}
          </form>

          <form action={deletePhotoAction}>
            <input type="hidden" name="id" value={photo.id} />
            <input type="hidden" name="dailyReportId" value={photo.dailyReportId} />
            <button type="submit" className="text-[11px] text-rose-600 underline">
              削除
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
