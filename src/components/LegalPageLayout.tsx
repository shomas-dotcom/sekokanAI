import Link from "next/link";

export function LegalPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-orange-700 underline">
        ← トップへ戻る
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        この文書は仮文面です。実際の公開前に、弁護士・行政書士等の専門家によるレビューを必ず受けてください。
      </div>
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}
