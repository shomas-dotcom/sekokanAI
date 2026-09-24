// アプリを「試験用データベース」につないで開発起動する(本番DB・本物のメール/AI/課金には触れない)。
// 使い方: 先に node tools/test-db/start.mjs を起動しておき、別の画面で node tools/test-db/dev.mjs
// 画面: http://localhost:3100
//
// .env には本番(Neon)の接続先が入っているため、ここで上書きしてから起動する。
// Next.js は、すでに設定済みの値を .env で上書きしない仕組みなので、この上書きが優先される。

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const env = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable",
  APP_URL: "http://localhost:3100",
  // 空にすると、メールは送らず画面確認用のログ出力、AIは簡易判定、課金は疑似動作になる。
  RESEND_API_KEY: "",
  AI_API_KEY: "",
  TRANSCRIPTION_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  STRIPE_PRICE_ID: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

const child = spawn("npx", ["next", "dev", "--port", "3100"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
