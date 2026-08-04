"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500"
    >
      印刷 / PDFとして保存
    </button>
  );
}
