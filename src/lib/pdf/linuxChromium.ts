import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

// 本番(Render、Linux)でPDFを作るChromeを動かすための準備。
//
// 2026-10調査: @sparticuz/chromium は、Chromeの起動に必要な共有ライブラリ(libnss3等)を
// 同梱しているが、それを展開して読み込み先(LD_LIBRARY_PATH)に加えるのは
// 「AWS Lambda / Vercel 等で動いていると判定したとき」だけ。Render はそのどれでもないため
// ライブラリが展開されず、Render の実行環境にライブラリが無ければChromeが起動できない
// (前回 2026-09 の修正で残っていた、本番だけPDFがエラーになる原因の候補)。
// ここで、判定に関係なく自分で展開して読み込み先に加える。

export type ChromiumHelpers = {
  inflate: (filePath: string) => Promise<string>;
  setupLambdaEnvironment: (baseLibPath: string) => void;
};

/** @sparticuz/chromium の圧縮ファイル(bin)の場所。パッケージは外部扱い(Next.jsの既定)なので実行時に解決できる。 */
export function resolveChromiumBinDir(): string {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  return path.join(path.dirname(require.resolve("@sparticuz/chromium")), "..", "bin");
}

/**
 * Chromeが使う共有ライブラリ(al2023.tar.br)を一時フォルダへ展開し、読み込み先に加える。
 * すでに展開済みなら展開はしない(inflate側で確認される)。展開先は /tmp/al2023/lib。
 */
export async function prepareLinuxChromiumLibraries(helpers: ChromiumHelpers, binDir: string): Promise<string> {
  await helpers.inflate(path.join(binDir, "al2023.tar.br"));
  const libDir = path.join(tmpdir(), "al2023", "lib");
  helpers.setupLambdaEnvironment(libDir);
  return libDir;
}
