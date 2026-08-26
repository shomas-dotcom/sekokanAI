import { prisma } from "../src/lib/prisma";
import { hash } from "../src/lib/password";

// 運営者(サービス提供者)アカウントを作成/更新する。会社(Company)には一切紐付かない。
// ADMIN_EMAIL / ADMIN_PASSWORD を環境変数で指定して実行する:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=xxxxxxxx npx tsx prisma/seedPlatformAdmin.ts
// 指定しない場合は開発用のダミー値を使う(本番では必ず指定し、後で必ず変更すること)。
async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@genba-ai.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin-password-change-me";
  const name = process.env.ADMIN_NAME || "運営管理者";

  const passwordHash = await hash(password);

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`運営者アカウントを作成/更新しました: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`(開発用の仮パスワードを使用しました: ${password} — 必ず変更してください)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
