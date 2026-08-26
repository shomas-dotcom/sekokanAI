import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/verification";
import { Card, Button } from "@/components/ui";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let message: string;
  let ok = false;

  if (!token) {
    message = "確認用のリンクが正しくありません。";
  } else {
    const userId = await consumeToken(token, "EMAIL_VERIFY");
    if (!userId) {
      message = "リンクの有効期限が切れているか、既に使用されています。もう一度お試しください。";
    } else {
      await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      message = "メールアドレスの確認が完了しました。";
      ok = true;
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-amber-600 via-orange-600 to-slate-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <Card className="text-center">
          <p className={ok ? "text-slate-900" : "text-rose-700"}>{message}</p>
          <Link href="/dashboard">
            <Button className="mt-6 w-full">ダッシュボードへ</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
