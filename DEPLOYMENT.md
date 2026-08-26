# 本番公開手順

現時点(Day1)ではクラウドDB/デプロイ先アカウントが未取得のため、この手順は**準備段階**であり実行はDay6-7以降、アカウント発行後となる。

## 前提(ユーザーが用意するもの)

1. GitHubリポジトリ(このプロジェクトをpush)
2. デプロイ先アカウント(Vercel想定)
3. クラウドDBアカウント(Neon/Supabase/Turso等)
4. ドメイン(既存の杉本土木ドメインとは別、または新規取得。既存HPには影響を与えない — [PROJECT_PLAN.md](./PROJECT_PLAN.md) の禁止事項)
5. AI APIキー
6. (決済機能実装後)Stripeアカウント

これらのアカウント作成・登録は事業者本人が行う([SECURITY.md](./SECURITY.md))。

## 手順

1. `npm run build` がローカルでエラー無く通ることを確認する
2. 本番用DBを用意し、`DATABASE_URL` を本番接続文字列に切り替える。SQLite用に書いた `PrismaLibSql` アダプタは本番DBの種類に応じて変更が必要(Postgresの場合は `@prisma/adapter-pg` 等に差し替え、[ARCHITECTURE.md](./ARCHITECTURE.md))
3. `npx prisma migrate deploy` で本番DBにマイグレーションを適用する(`migrate dev` ではなく `deploy` を使う — マイグレーション履歴のみ適用し、スキーマの差分生成は行わない)
4. デプロイ先の環境変数管理画面に [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) の値を設定する(`.env` ファイルは本番にコミット・アップロードしない)
5. デプロイを実行する
6. デプロイ後、[TEST_PLAN.md](./TEST_PLAN.md) のスモークテスト(ログイン・見積作成・PDF出力)を本番URLで実施する
7. 本番公開前の確認事項一覧([RISK_REGISTER.md](./RISK_REGISTER.md))を消込む

## 既知の制約(日報の現場写真)

現場写真(`DailyReportPhoto`)は、クラウドストレージ未契約([no-billing-without-confirmation])
のためSQLite/本番Postgres内にBLOBとして保存するMVP措置を取っている。大量・高解像度の写真を
長期間扱う運用になった場合は、外部ストレージ(S3/Cloudflare R2等)への切替を検討すること。
切替は要ユーザー確認(新規の課金発生のため)。

## ロールバック手順

1. デプロイ先の管理画面から直前の正常デプロイに切り戻す(Vercel等は過去デプロイへのInstant Rollback機能を持つ)
2. DBマイグレーションを伴う変更の場合、切り戻し前に影響範囲を確認する(破壊的マイグレーションは避け、後方互換性のある変更を優先する)
3. ロールバック実施後、[CHANGELOG.md](./CHANGELOG.md) に記録する
