import Link from "next/link";
import { Card, Button } from "@/components/ui";

export function UpgradePrompt({ featureName }: { featureName: string }) {
  return (
    <Card className="max-w-lg border-indigo-100 bg-indigo-50/50">
      <p className="text-sm font-semibold text-indigo-900">「{featureName}」はAIプレミアム機能です</p>
      <p className="mt-2 text-sm text-indigo-700">
        現在のプランでは利用できません。AIプレミアムにアップグレードすると、この機能を含むAI文書作成機能が利用できるようになります。
      </p>
      <Link href="/premium">
        <Button variant="ai" className="mt-4">
          AIプレミアムを見る
        </Button>
      </Link>
    </Card>
  );
}
