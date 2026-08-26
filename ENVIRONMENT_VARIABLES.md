# 環境変数一覧

雛形は [.env.example](./.env.example)。実際の値は `.env`(gitignore対象)に設定する。本番はRenderの環境変数管理画面から設定し、コード・リポジトリに直書きしない([SECURITY.md](./SECURITY.md))。`render.yaml` に主な項目を定義済み。

| 変数名 | 必須 | 説明 | 現状 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 必須 | DB接続文字列。開発は `file:./dev.db`(SQLite/libsql)。本番はPostgres接続文字列に変更が必要([DEPLOYMENT.md](./DEPLOYMENT.md)のPostgres移行手順を参照) | 開発用設定済み、本番未移行 |
| `AUTH_SECRET` | 必須 | セッション署名用のランダム文字列(Renderでは自動生成可) | 未設定 |
| `AUTH_URL` | 必須 | 認証コールバックの基準URL | 未設定 |
| `APP_URL` | 本番必須 | アプリの公開URL(メール本文のリンク生成等に使用) | 未設定 |
| `AI_API_KEY` | 任意 | 未設定時はAI機能がモック応答(ルールベース)で動作する | 未設定 |
| `AI_API_PROVIDER` | 任意 | AI抽象化レイヤーが参照するプロバイダ識別子(既定 `anthropic`) | 既定値 |
| `RESEND_API_KEY` | 任意 | 未設定時はメール送信がログ出力のみのモックで動作する(メール認証・パスワード再設定に影響) | 未設定 |
| `EMAIL_FROM` | 任意 | 送信元メールアドレス | 未設定 |
| `STRIPE_SECRET_KEY` | 任意 | 未設定時は決済が「開発用の疑似トライアル」で動作する(実課金なし) | 未設定 |
| `STRIPE_WEBHOOK_SECRET` | Stripe利用時必須 | Webhookの署名検証に使用 | 未設定 |
| `STRIPE_PUBLISHABLE_KEY` | 現状未使用 | 将来クライアント側でStripe.jsを使う場合に備えて用意 | 未設定 |
| `STRIPE_PRICE_ID` | Stripe利用時必須 | 月額9,800円プランのPrice ID(`price_`で始まる) | 未設定 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | 運営管理画面利用時必須 | `npm run db:seed-admin` 実行時にのみ使用(常駐の環境変数ではない) | 開発用ダミー値で動作中 |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | 未実装 | 現在写真はDB内保存(BLOB)。外部ストレージへの切替時に必要になる想定の項目(切替は要ユーザー確認) | 未設定・未使用 |

## 禁止事項

- 銀行口座情報(銀行名・支店名・口座種別・口座番号・口座名義・法人番号)を環境変数名・値としてこのリポジトリに保存しない。振込先情報は会社設定画面(`/settings`)から事業者が登録する
- `.env*` ファイル(`.env.example` を除く)はコミットしない(`.gitignore` で除外済み)
- 本番用のAPIキー・パスワードをこのファイルやチャット上に直接貼り付けない。必ずRenderの環境変数管理画面から直接入力する
