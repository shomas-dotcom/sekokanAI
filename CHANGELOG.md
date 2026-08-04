# Changelog

## Day 1 — 2026-08-04

- リポジトリ雛形作成(Next.js 16 + TypeScript + Tailwind CSS v4)
- Prismaスキーマ設計(Company/User/Customer/Project/Quote+QuoteItem/DailyReport/ConstructionPlan+ConstructionPlanSection/Template/AuditLog)、SQLite開発DB(libsqlドライバアダプタ)でマイグレーション適用
- パスワードハッシュユーティリティ(`src/lib/password.ts`, Node組み込みscrypt)
- デモシードスクリプト(`prisma/seed.ts`)、型チェック・本番ビルド確認済み
- 必須ドキュメント一式を作成([README.md](./README.md) のドキュメント一覧を参照)
- 市場調査(競合価格帯: ANDPAD, Concrew AI, nanoty等)を実施し [PRICING.md](./PRICING.md) に反映
