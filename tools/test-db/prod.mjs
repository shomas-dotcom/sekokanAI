// 本番と同じ動き(NODE_ENV=production)のアプリを「試験用データベース」につないで起動する。
// リリース前に「本番ではデモ機能が隠れているか」等を、本番DBに触れずに確かめるための道具。
// 使い方: 先に node tools/test-db/start.mjs を起動し、npm run build を済ませてから
//         node tools/test-db/prod.mjs   → http://localhost:3200

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const env = {
  ...process.env,
  NODE_ENV: "production",
  // 別の試験用DBを使うときは TEST_DATABASE_URL で差し替えられる
  DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable",
  APP_URL: "http://localhost:3200",
  RESEND_API_KEY: "",
  AI_API_KEY: "",
  TRANSCRIPTION_API_KEY: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  STRIPE_PRICE_ID: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  ALLOW_MOCK_BILLING: "",
};

const child = spawn("npx next start --port 3200", { cwd: projectRoot, env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
