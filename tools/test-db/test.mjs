// 自動試験を「試験用データベース」につないで全部動かす(DBに書き込む *.db.test.ts も含む)。
// 使い方: 先に node tools/test-db/start.mjs を起動し、保存項目を最新にしておく(README.md 参照)。
//         そのあと npm run test:db
//
// .env には本番(Neon)の接続先が入っているため、ここで上書きしてから vitest を起動する。
// dotenv はすでに設定済みの値を上書きしないので、この上書きが優先される。

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const env = {
  ...process.env,
  // 別の試験用DBを使うときは TEST_DATABASE_URL で差し替えられる
  DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable",
  AI_API_KEY: "",
  RESEND_API_KEY: "",
  STRIPE_SECRET_KEY: "",
};

const args = process.argv.slice(2).map((a) => JSON.stringify(a)).join(" ");
const child = spawn(`npx vitest run ${args}`, {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
