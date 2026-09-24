// 試験用データベース(このパソコンの中だけで動くPostgreSQL)を起動する。
// 本番(Neon)とは無関係。データは tools/test-db/data に保存され、Gitには入れない。
//
// 使い方: node tools/test-db/start.mjs          (起動。止めるときは Ctrl+C)
//         node tools/test-db/start.mjs --reset  (中身を全部消して作り直す)
// 接続先: postgresql://postgres:postgres@127.0.0.1:55432/postgres
//
// なぜPGliteか: 無料・アカウント不要・インストール不要で、本番と同じPostgreSQLの
// 動きを確かめられるため(SQLiteでは本番と違う動きになる)。

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = 55432; // 通常のPostgreSQL(5432)と重ならない番号にする
const dataDir = fileURLToPath(new URL("./data", import.meta.url));

if (process.argv.includes("--reset")) {
  rmSync(dataDir, { recursive: true, force: true });
  console.log("[test-db] 試験用データを消去しました。");
}

const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();

console.log(`[test-db] 試験用データベースを起動しました: postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`);
console.log("[test-db] 止めるときは Ctrl+C を押してください。");

const shutdown = async () => {
  await server.stop();
  await db.close();
  console.log("[test-db] 停止しました。");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
