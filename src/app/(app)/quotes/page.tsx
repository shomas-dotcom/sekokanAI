import { requireUser } from "@/lib/auth";

export default async function QuotesPage() {
  await requireUser();
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">見積</h1>
      <p className="mt-2 text-sm text-zinc-500">Day3で実装予定です。</p>
    </div>
  );
}
