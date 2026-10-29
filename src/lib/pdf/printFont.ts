import { Noto_Sans_JP } from "next/font/google";

// PDF・印刷用画面の日本語フォント。
//
// 画面全体のフォント(Geist)は英数字だけで、日本語は端末に入っているフォントで表示している。
// 本番サーバー(Render、Linux)には日本語フォントが入っていないため、サーバーでPDFを作ると
// 日本語が「□」になってしまう。ビルド時にフォントを取り込んでアプリ自身から配る(next/fontの仕組み。
// 閲覧時にGoogleへは通信しない)ことで、どこでPDFを作っても同じ見た目にする。
// 日本語の文字は分割されたファイルから必要な分だけ読まれるため、先読み(preload)はしない。
export const printFont = Noto_Sans_JP({
  subsets: ["latin"],
  preload: false,
  display: "block",
});
