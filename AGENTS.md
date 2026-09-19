<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Codex作業ルール

## 目的

建設会社向け「現場AI」を、安全に改善する。

## 作業前

- README、現在の作業指示、関連コードを読む。
- 現在の変更状況を確認し、利用者の未保存変更を消さない。
- 不明な仕様は推測で本番実装せず、質問または仮定を明記する。

## 作業中

- 1回の作業では1つの目的に集中する。
- 会社ごとのデータが混ざらない仕組みを維持する。
- スマホ表示、写真・ファイル添付、社員同期への影響を確認する。
- パスワード、APIキー、個人情報をコードや記録へ書かない。
- データを削除・変更する処理には確認と復旧方法を用意する。

## 完了条件

- 指示書の受入条件をすべて確認する。
- 関連テストを実行する。
- 変更ファイル、テスト結果、残る注意点を日本語で報告する。
- 本番公開は、利用者から明示された場合のみ行う。
