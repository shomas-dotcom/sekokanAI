import { fileURLToPath } from "node:url";
import "dotenv/config";
import { configDefaults, defineConfig } from "vitest/config";

// 実際にデータベースへ書き込む試験(*.db.test.ts)は、このパソコンの中のDB
// (tools/test-db の試験用DB)につないでいるときだけ動かす。
// .env の DATABASE_URL は本番(Neon)を指しているため、そのまま `npm test` すると
// 本番に試験用の会社を作っては消すことになる。これを防ぐ。
function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

const runDbTests = isLocalDatabase(process.env.DATABASE_URL);
if (!runDbTests) {
  console.warn(
    "[test] DATABASE_URL がこのパソコンの外を指しているため、DBに書き込む試験(*.db.test.ts)は飛ばします。" +
      "動かすには試験用DBを起動してから `npm run test:db` を使ってください(tools/test-db/README.md)。",
  );
}

export default defineConfig({
  test: {
    environment: "node",
    exclude: runDbTests ? configDefaults.exclude : [...configDefaults.exclude, "**/*.db.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
