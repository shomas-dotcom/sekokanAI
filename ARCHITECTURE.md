# システム構成

## 技術スタック

| 領域 | 選定 | 理由 |
| --- | --- | --- |
| フロントエンド/バックエンド | Next.js 16 (App Router, TypeScript) | フルスタックを1リポジトリで完結でき、Server Actionsでフォーム処理を簡潔に書ける |
| UI | Tailwind CSS v4 | create-next-appの標準構成、スマホ対応のユーティリティが豊富 |
| DB | SQLite(開発, libsqlドライバアダプタ経由) → Postgres等(本番、未確定) | 非管理者Windows環境でローカルPostgresサーバーを導入できないため開発はSQLiteに変更。本番はユーザーがクラウドDBアカウントを用意した時点で切替 |
| ORM | Prisma 7 | 型安全なスキーマ管理。v7からdriver adapter必須のため `@prisma/adapter-libsql` を使用(better-sqlite3等ネイティブビルド系は非管理者環境で失敗するリスクがあるため避けた) |
| 認証 | 未実装(Day2でAuth.js導入予定) | — |
| AI | 抽象化レイヤー([ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)) | 特定ベンダーへの依存を避け、`AI_API_KEY`未設定時はモック応答で開発継続可能にする |
| デプロイ | 未確定(Vercel想定) | クラウドアカウント未取得のため、Day6-7でアカウント発行後に確定 |

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
