"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500"
    >
      印刷 / PDFとして保存
    </button>
  );
}
