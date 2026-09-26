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
      <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </div>
  );
}
