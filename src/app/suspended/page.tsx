import { Card } from "@/components/ui";

export default function SuspendedPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card className="text-center">
          <h1 className="text-lg font-bold text-slate-900">現在ご利用いただけません</h1>
          <p className="mt-3 text-sm text-slate-600">
            このアカウントは現在利用が停止されています。お心当たりがない場合や、ご不明な点がある場合は運営までお問い合わせください。
          </p>
        </Card>
      </div>
    </div>
  );
}
