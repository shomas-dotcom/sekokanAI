# 環境変数一覧

雛形は [.env.example](./.env.example)。実際の値は `.env`(gitignore対象)に設定する。本番はデプロイ先の環境変数管理画面から設定し、コード・リポジトリに直書きしない([SECURITY.md](./SECURITY.md))。

| 変数名 | 必須 | 説明 | Day1時点の状態 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 必須 | DB接続文字列。開発は `file:./dev.db`(SQLite/libsql) | 設定済み(開発用) |
| `AUTH_SECRET` | Day2から必須 | セッション署名用のランダム文字列 | 未設定 |
| `AUTH_URL` | Day2から必須 | 認証コールバックの基準URL | 未設定 |
| `AI_API_KEY` | 任意 | 未設定時はAI機能がモック応答で動作する | 未設定(ユーザー未取得。取得後に設定) |
| `AI_API_PROVIDER` | 任意 | AI抽象化レイヤーが参照するプロバイダ識別子(既定 `anthropic`) | 既定値 |
| `APP_URL` | 本番必須 | アプリの公開URL | 未設定 |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | 優先度B(写真アップロード)から必須 | S3互換ストレージの接続情報 | 未設定 |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PUBLISHABLE_KEY` | 決済機能実装時に必須 | Stripeテストモードキーから開始 | 未設定 |

## 禁止事項

- 銀行口座情報(銀行名・支店名・口座種別・口座番号・口座名義・法人番号)を環境変数名・値としてこのリポジトリに保存しない。振込先情報は本番公開後に事業者が決済/管理画面から登録する
- `.env*` ファイル(`.env.example` を除く)はコミットしない(`.gitignore` で除外済み)
