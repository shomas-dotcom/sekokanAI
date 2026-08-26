# 本番公開手順(Render)

この手順は、Renderへの本番公開を前提にしている。実行には事業者本人によるアカウント作成が必要な箇所がある([SECURITY.md](./SECURITY.md)、詳細は各手順に記載)。

## 前提(ユーザーが用意するもの)

1. GitHubリポジトリ(このプロジェクトをpush済みであること)
2. [Render](https://render.com)の無料アカウント
3. **本番用Postgresデータベース**(無料枠のある[Neon](https://neon.tech)または[Supabase](https://supabase.com)を推奨)。**開発中のSQLiteのままでは本番公開できない**(複数人が同時に使うと壊れるため)
4. ドメイン(任意。無ければRenderが発行する `xxx.onrender.com` で公開できる。既存の杉本土木ドメインとは別にすること — 既存HPへの影響を避けるため)
5. AI APIキー(任意。未設定でもモック応答で動作する)
6. Stripeアカウント([PRICING.md](./PRICING.md)、Phase8で実装済み。未設定でも疑似トライアルとして動作する)
7. Resend(メール送信)アカウント(任意。未設定でもログ出力のみのモックで動作する)

これらのアカウント作成・登録・入力は事業者本人が行うこと(このリポジトリのAIエージェントは代行しない)。

## Postgres移行(本番公開前に必ず1回だけ行う)

現在の開発DBはSQLite(`file:./dev.db`、libsqlドライバ経由)。本番はPostgresへ切り替える必要があり、これは**後戻りしにくい一度きりの作業**なので、事業者の立ち会いのもとで慎重に行うこと。

1. Neon/Supabase等でPostgresデータベースを作成し、接続文字列(`postgresql://...`)を取得する
2. `prisma/schema.prisma` の `datasource db` を `provider = "postgresql"` に変更する
3. `src/lib/prisma.ts` のドライバアダプタを `PrismaLibSql` から `@prisma/adapter-pg`(`npm install @prisma/adapter-pg pg` が必要)に差し替える
4. ローカルの `.env` の `DATABASE_URL` を取得した接続文字列に変更し、`npx prisma migrate dev` でマイグレーション履歴がそのまま適用できることを確認する
5. 問題なければコミットする(この変更は別途、動作確認とセットで実施すること)

## デプロイ手順

1. `npm run build` がローカルでエラー無く通ることを確認する
2. リポジトリ直下の `render.yaml` を使い、RenderのWeb UIで「New +」→「Blueprint」からこのリポジトリを選択する(`render.yaml` に主な設定を書いてあるので、画面では空欄の環境変数を埋めるだけでよい)
3. 空欄の環境変数を [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) を見ながら入力する(`DATABASE_URL` は上記Postgres移行で取得した接続文字列)
4. デプロイを実行する(`render.yaml` のbuildCommandで `prisma migrate deploy` が自動実行され、マイグレーションが本番DBに適用される)
5. デプロイ完了後、`npm run db:seed-admin`(運営管理画面のアカウント作成)を本番環境に対して1回だけ実行する(Renderのシェル機能、またはローカルから本番の `DATABASE_URL` を指定して実行する)
6. 本番URLで以下のスモークテストを実施する: 会社登録→ログイン→現場登録→AI日報作成→見積作成→PDF出力→ログアウト
7. Stripeダッシュボードで、Webhook送信先を `https://本番URL/api/stripe/webhook` に設定する
8. 本番公開前の確認事項一覧([RISK_REGISTER.md](./RISK_REGISTER.md))を消込む

## 既知の制約(現場写真)

現場写真(`DailyReportPhoto`)は、クラウドストレージ未契約のためPostgres内にBLOBとして保存するMVP措置を取っている。大量・高解像度の写真を長期間扱う運用になった場合は、外部ストレージ(S3/Cloudflare R2等)への切替を検討すること。切替は要ユーザー確認(新規の課金発生のため)。

## ロールバック手順

1. Renderのダッシュボードから直前の正常デプロイに切り戻す(Renderは過去デプロイへのロールバック機能を持つ)
2. DBマイグレーションを伴う変更の場合、切り戻し前に影響範囲を確認する(破壊的マイグレーションは避け、後方互換性のある変更を優先する)
3. ロールバック実施後、[CHANGELOG.md](./CHANGELOG.md) に記録する
