# genba-ai(現場AI)

建設業(土木・外構・造成・舗装)向けAI業務改善パッケージ。杉本土木株式会社が自社の施工管理経験をもとに開発する、初期導入型の受託販売SaaS雛形。

見積作成・音声入力・日報作成・施工計画書下書き・顧客/案件管理をひとつにまとめ、現場からスマートフォンで完結させることを目指す。詳細な背景と10日間の実行計画は [PROJECT_PLAN.md](./PROJECT_PLAN.md) を参照。

## 現在のステータス(Day 1)

- [x] 技術構成決定・リポジトリ雛形
- [x] Prismaスキーマ(会社/顧客/案件/見積/日報/施工計画書/テンプレート/監査ログ)
- [x] SQLite開発DB + デモシード
- [ ] 認証・会社登録・顧客/案件管理(Day2〜)
- [ ] AI見積・音声入力・日報・施工計画書下書き(Day3〜5)
- [ ] LP・営業資料・販売開始(Day6〜10)

進捗の詳細は [TEN_DAY_PLAN.md](./TEN_DAY_PLAN.md) と [DAILY_REPORT.md](./DAILY_REPORT.md) を参照。

## 技術構成

- Next.js 16(App Router, TypeScript, Tailwind CSS v4)
- Prisma 7 + SQLite(開発、libsqlドライバアダプタ経由)→ 本番はクラウドDBへ切替可能
- 認証: 未実装(Day2でAuth.js導入予定)
- AI: 抽象化レイヤー経由、`AI_API_KEY` 未設定時はモック応答([ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md))

選定理由は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。このNext.jsのバージョンは学習データと挙動が異なるため、コード変更前に `node_modules/next/dist/docs/` を確認すること([AGENTS.md](./AGENTS.md))。

## セットアップ

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

`http://localhost:3000` を開く。デモアカウント: `demo@genba-ai.local` / `demo-password-change-me`(開発専用ダミー値、本番では使用しないこと)。

## 主なコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run db:migrate` | Prismaマイグレーション適用 |
| `npm run db:seed` | デモデータ投入 |
| `npm run db:studio` | Prisma Studio(DBブラウザ)起動 |

## ドキュメント一覧

- [PROJECT_PLAN.md](./PROJECT_PLAN.md) — 事業計画・商品設計
- [REQUIREMENTS.md](./REQUIREMENTS.md) — 機能要件(優先度A/B/C)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — システム構成
- [SECURITY.md](./SECURITY.md) / [PRIVACY.md](./PRIVACY.md) — セキュリティ・個人情報方針
- [DEPLOYMENT.md](./DEPLOYMENT.md) — 本番公開手順
- [TEST_PLAN.md](./TEST_PLAN.md) — テスト計画
- [SALES_PLAN.md](./SALES_PLAN.md) / [PRICING.md](./PRICING.md) — 営業・価格戦略
- [TEN_DAY_PLAN.md](./TEN_DAY_PLAN.md) / [DAILY_REPORT.md](./DAILY_REPORT.md) — 実行計画・日次レポート
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) — 環境変数一覧
- [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) — 運用マニュアル
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) — バックアップ・復旧
- [RISK_REGISTER.md](./RISK_REGISTER.md) — リスク一覧
- [CHANGELOG.md](./CHANGELOG.md) — 変更履歴

## できないこと(重要)

このリポジトリはコードとドキュメントの雛形であり、以下は**自動化されていない/意図的に人間の確認を挟む**:

- 実在の見込み客へのメール送信・DM送信・電話営業・Instagram投稿・HP記事公開
- GitHub/Vercel/Supabase/Stripe等の外部アカウント作成、本番APIキー・銀行口座・決済情報の登録
- 売上・成約実績の保証や捏造

詳細は [SALES_PLAN.md](./SALES_PLAN.md) の「実行区分」を参照。
