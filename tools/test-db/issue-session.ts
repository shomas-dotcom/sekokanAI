// 試験用DBの利用者に、画面確認用のログイン状態(セッション)を発行する(本番では使えない)。
// 自動の画面確認でパスワードを入力せずに、役割ごとの見え方を確かめるための道具。
// 実行: npx tsx tools/test-db/issue-session.ts member@genba-ai.local
// 出力されたトークンを、ブラウザの genba_session クッキーに入れるとその利用者で表示される。

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../../src/lib/prisma";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error("DATABASE_URL が試験用(127.0.0.1)ではないため中止しました。");
  }
  const email = process.argv[2];
  if (!email) throw new Error("メールアドレスを指定してください。");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`${email} が見つかりません。`);

  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log(token);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
