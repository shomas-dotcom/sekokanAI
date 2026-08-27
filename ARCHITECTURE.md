# システム構成

## 技術スタック

| 領域 | 選定 | 理由 |
| --- | --- | --- |
| フロントエンド/バックエンド | Next.js 16 (App Router, TypeScript) | フルスタックを1リポジトリで完結でき、Server Actionsでフォーム処理を簡潔に書ける |
| UI | Tailwind CSS v4 | create-next-appの標準構成、スマホ対応のユーティリティが豊富 |
| DB | Postgres(Neon等のクラウドDB、`@prisma/adapter-pg`経由) | 2026-08-27追記: 事業者がNeonの無料アカウントを取得したため、開発当初のSQLite(非管理者Windows環境でローカルPostgresを導入できなかったための暫定措置)から移行した。旧SQLiteのマイグレーション履歴は`prisma/migrations_sqlite_archive`に記録として保持 |
| ORM | Prisma 7 | 型安全なスキーマ管理。v7からdriver adapter必須のため `@prisma/adapter-pg` を使用 |
| 認証 | 自前実装(scryptパスワードハッシュ・Cookieセッション) | 2026-08-26追記: Auth.js等は導入せず、Node標準のscryptとハッシュ化済みセッショントークンによる自前実装とした(依存を減らし、動作を完全に把握できる範囲に留めるため) |
| AI | 抽象化レイヤー([ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)) | 特定ベンダーへの依存を避け、`AI_API_KEY`未設定時はモック応答で開発継続可能にする。2026-08-26時点でも実AI APIへの接続は未実施(ルールベースのモックのみ) |
| デプロイ | Render(想定、[DEPLOYMENT.md](./DEPLOYMENT.md)) | 2026-08-26追記: Vercelから方針変更。`render.yaml`を用意済みだが、実デプロイは事業者のRenderアカウント取得後に実施予定 |

Next.js 16はApp Router/キャッシュ周りに破壊的変更があるため、コード変更前に `node_modules/next/dist/docs/` を確認する運用とする([AGENTS.md](./AGENTS.md)、`next dev` が自動再生成)。Cache Components(`cacheComponents: true`)は本プロジェクトでは有効化しない — ログイン後のダッシュボード中心のCRUDアプリであり、静的シェル最適化よりも実装のシンプルさを優先する。

## データモデル(マルチテナント)

[prisma/schema.prisma](./prisma/schema.prisma) 参照。すべての業務テーブルは `companyId` を持ち、会社単位でデータを分離する。データアクセス層(Server Actions/Route Handlers)は必ず認証済みユーザーの `companyId` でフィルタし、他社データへのアクセスを防ぐ(会社間データ分離テストを [TEST_PLAN.md](./TEST_PLAN.md) に定義)。

主要モデル: `Company` / `User` / `Customer` / `Project` / `Quote` + `QuoteItem` / `DailyReport` / `ConstructionPlan` + `ConstructionPlanSection` / `Template` / `AuditLog`。

## ディレクトリ構成(予定)

```
src/
  app/            # App Router (page/layout/route)
  lib/
    prisma.ts     # Prisma Clientシングルトン
    password.ts   # パスワードハッシュ(scrypt)
    ai/           # AI抽象化レイヤー(Day3〜)
  generated/prisma # Prisma生成コード(gitignore対象)
prisma/
  schema.prisma
  migrations/
  seed.ts
```

## AI抽象化レイヤーの方針(Day3で実装)

特定のAIベンダー1社に依存しすぎない設計とする。`src/lib/ai/` にプロバイダ非依存のインターフェースを定義し、`AI_API_KEY` が未設定の間はモック実装を返す。本番投入前にプロンプト・出力形式の妥当性をテストする([TEST_PLAN.md](./TEST_PLAN.md) の「AI出力テスト」)。

## 決済(将来実装)

Stripe等の一般的な決済サービスを想定し、テストモードから開始する。本番APIキー・銀行振込先情報は事業者本人が管理画面またはStripe管理画面から登録する構成とし、コード・DB初期値・ログに直書きしない([SECURITY.md](./SECURITY.md))。
