import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Card, Badge } from "@/components/ui";

// 「AIツール」メニュー。既存の機能への入り口を1か所にまとめて見せるだけのページ
// (新しい機能は作らず、既存ページへのリンク集にする)。まだ無い機能は「準備中」と
// 正直に表示し、無いものをあるように見せない。
type Tool = {
  emoji: string;
  name: string;
  description: string;
  href: string;
  status: "available" | "coming_soon";
};

const TOOLS: Tool[] = [
  {
    emoji: "🧾",
    name: "AI見積作成",
    description: "音声・写真・文章から見積の下書きを作る",
    href: "/quotes/new",
    status: "available",
  },
  {
    emoji: "💴",
    name: "AI請求書作成",
    description: "契約内容から請求書を自動で組み立てる",
    href: "/invoices/new",
    status: "available",
  },
  {
    emoji: "📷",
    name: "AI写真帳作成",
    description: "現場写真の整理・帳票化(準備中)",
    href: "/daily-reports",
    status: "coming_soon",
  },
  {
    emoji: "📐",
    name: "AI測量報告書作成",
    description: "測量結果から報告書を作る(準備中)",
    href: "/daily-reports",
    status: "coming_soon",
  },
  {
    emoji: "📋",
    name: "AI施工計画書作成",
    description: "案件情報から施工計画書の下書きを作る",
    href: "/construction-plans",
    status: "available",
  },
  {
    emoji: "📝",
    name: "AI日報作成",
    description: "音声で話した内容をそのまま日報にする",
    href: "/daily-reports/new",
    status: "available",
  },
  {
    emoji: "👤",
    name: "AI顧客登録",
    description: "名刺の撮影・音声・文章から顧客を登録する",
    href: "/customers/new",
    status: "available",
  },
  {
    emoji: "🏗️",
    name: "AI案件登録",
    description: "見積依頼のメモや写真から案件を登録する",
    href: "/projects/new",
    status: "available",
  },
  {
    emoji: "✍️",
    name: "AI文章作成",
    description: "案内文・お知らせ文の作成(準備中)",
    href: "/dashboard",
    status: "coming_soon",
  },
  {
    emoji: "📱",
    name: "AI SNS投稿作成",
    description: "実績データをもとにした投稿文の作成(準備中)",
    href: "/dashboard",
    status: "coming_soon",
  },
];

export default async function AiToolsPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AIツール</h1>
        <p className="mt-1 text-sm text-slate-500">
          写真・音声・文章を入れるだけで、各業務の下書きを作れます。内容は必ず確認してから登録してください。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.name}
            href={tool.href}
            className="block transition hover:-translate-y-0.5"
            aria-disabled={tool.status === "coming_soon"}
          >
            <Card className="flex h-full items-start gap-3">
              <span className="text-3xl">{tool.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{tool.name}</span>
                  {tool.status === "coming_soon" && <Badge className="bg-slate-100 text-slate-500">準備中</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
