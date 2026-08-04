import { requireUser } from "@/lib/auth";

export default async function ConstructionPlansPage() {
  await requireUser();
  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">施工計画書</h1>
      <p className="mt-2 text-sm text-zinc-500">Day5で実装予定です。</p>
    </div>
  );
}
