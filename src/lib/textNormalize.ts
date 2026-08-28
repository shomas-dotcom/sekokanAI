// 画像/PDF/Excel/Word/音声など、あらゆる入力元から取り出した文字列を、AIに渡す前に
// 揃えるための共通処理(「共通AIファイル解析基盤」の①文字列正規化にあたる)。
//
// 対応する代表的な崩れ:
// - 全角/半角の表記ゆれ(Ａ１２３ → A123)
// - ①②③等の丸数字(NFKC正規化により "1" "2" "3" に展開される)
// - ㎡ / m² / m2 の表記ゆれ(NFKCで ㎡→"m2"、m²→"m2" に揃う。㎥も同様に "m3" に揃う)
// - 改行コードの揺れ(\r\n, \r → \n)、行末の余分な空白、連続する空行
//
// 対応できない/対応しないこと:
// - 文字化け(そもそも間違った文字コードで読み込んでしまった文字列)の復元。
//   これは正規化では直せないため、ファイルを読み込む側で文字コードを正しく
//   判定・デコードすることが必要(PDF/Excel/Word解析の実装時に別途対応する)。
export function normalizeExtractedText(text: string): string {
  if (!text) return text;

  let normalized = text
    // Unicode正規化(全角/半角、丸数字、上付き数字等の表記ゆれをまとめて解消する)
    .normalize("NFKC")
    // 改行コードを統一
    .replace(/\r\n|\r/g, "\n");

  // 行ごとに行末の空白を除去し、3行以上続く空行は2行(空行1つ)にまとめる
  normalized = normalized
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized;
}
