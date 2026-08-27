# genba-ai(現場AI)

建設業(土木・外構・造成・舗装)向けAI業務改善パッケージ。杉本土木株式会社が自社の施工管理経験をもとに開発する、初期導入型の受託販売SaaS雛形。

見積作成・音声入力・日報作成・施工計画書下書き・顧客/案件管理・**工事請負契約書・請求書**をひとつにまとめ、現場からスマートフォンで完結させることを目指す。詳細な背景と10日間の実行計画は [PROJECT_PLAN.md](./PROJECT_PLAN.md) を参照。

## 現在のステータス(Day 6)

- [x] 技術構成決定・リポジトリ雛形
- [x] Prismaスキーマ(会社/顧客/案件/見積/契約書/請求書/日報/施工計画書/テンプレート/採番/監査ログ)
- [x] SQLite開発DB + デモシード(見積→契約→請求までの一連のデモデータ)
- [x] 認証・会社登録・顧客/案件管理(Day2)
- [x] AI見積・音声入力・日報・施工計画書下書き(Day3〜5)
- [x] フリーミアム化(Day5)
- [x] 会社設定画面・工事番号/見積番号/契約番号/請求番号の自動採番・工事請負契約書(DOCX/PDF出力)・請求書(出来高/分割請求対応、残額整合性チェック)・案件詳細への簡易工事台帳(Day6)
- [ ] LP・営業資料・販売開始(Day7〜10)

進捗の詳細は [TEN_DAY_PLAN.md](./TEN_DAY_PLAN.md) と [DAILY_REPORT.md](./DAILY_REPORT.md) を参照。

## 主な機能(2026-08-05時点)

- 会社情報登録・編集(`/settings`、適格請求書発行事業者登録番号・建設業許可番号・振込先を含む)
- 顧客管理・案件管理(工事番号自動採番、現場代理人・主任技術者・契約金額目安等)
- 見積書(AI下書き・明細編集・印刷/PDF保存・複製)
- **工事請負契約書**(`/contracts`、見積からの金額反映・18条項の編集・確定時のスナップショット保存・DOCX/印刷出力、法的免責注記表示)
- **請求書**(`/invoices`、全額/着手金/中間金・出来高/一部/完成時請求、前回・累計・残額の自動計算、契約金額超過時は保存不可、発行時のスナップショット保存・印刷出力)
- 日報(音声入力)・施工計画書下書き(17章)
- 案件詳細に見積・契約書・請求書をまとめた簡易工事台帳

## 技術構成

- Next.js 16(App Router, TypeScript, Tailwind CSS v4)
- Prisma 7 + Postgres(`@prisma/adapter-pg`経由。開発・本番ともNeon等のクラウドPostgresを利用。2026-08-27にSQLiteから移行、旧マイグレーションは`prisma/migrations_sqlite_archive`に記録として保持)
- 認証: 自前実装(scryptパスワードハッシュ・Cookieセッション、Auth.js等の外部ライブラリは未使用)
- AI: 抽象化レイヤー経由、`AI_API_KEY` 未設定時はモック応答([ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md))

選定理由は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。このNext.jsのバージョンは学習データと挙動が異なるため、コード変更前に `node_modules/next/dist/docs/` を確認すること([AGENTS.md](./AGENTS.md))。

## セットアップ

```bash
npm install
cp .env.example .env
# .env の DATABASE_URL に、Neon等で取得したPostgres接続文字列を設定する
# (2026-08-27以降、SQLiteでは動作しない。無料枠のある https://neon.tech を推奨)
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
| `npm run test` | 単体・結合テスト実行(Vitest) |
| `npm run test:watch` | テストをウォッチモードで実行 |
| `npm run lint` | ESLint実行 |

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

## 帳票生成

見積書・工事請負契約書・請求書は、各詳細画面の「印刷 / PDF保存」からブラウザの印刷機能でPDF保存できる(A4縦、印刷用CSSで改ページ・マージンを制御)。工事請負契約書のみ「Wordで出力」から編集可能なDOCXを直接ダウンロードできる(`docx`ライブラリ、`src/lib/docx/contractDocx.ts`)。

## 既知の制限

- 工事台帳・工程表(ガントチャート)は未実装。案件詳細ページの簡易一覧(見積/契約書/請求書へのリンク)のみ提供
- 請求書の明細はitemベースで小計・税額を計算する方式のみ対応。契約金額に対する「出来高率(%)」からの自動計算補助は未実装(今回請求額は明細合計で入力する)
- 郵便番号からの住所補完(外部API連携)は未実装
- E2Eテスト(Playwright)は未導入。単体・結合テストはVitestで実施([TEST_PLAN.md](./TEST_PLAN.md))
- 見積・契約書・請求書の端数処理は現在「四捨五入」固定(契約書・請求書の計算関数`src/lib/calc.ts`自体は切り捨て/切り上げにも対応済みだが、画面から選択する設定項目は未実装)

## 法務・税務上の注意事項

工事請負契約書はシステムが自動生成する一般的なひな形であり、法的有効性を保証するものではない。個別案件の内容、取引条件、法令および発注者指定条件に応じて、行政書士・弁護士・税理士等の専門家へ必ず確認すること。消費税・インボイス制度に関する表示(適格請求書発行事業者登録番号等)も参考情報であり、税務上の適法性を保証するものではない。

## できないこと(重要)

このリポジトリはコードとドキュメントの雛形であり、以下は**自動化されていない/意図的に人間の確認を挟む**:

- 実在の見込み客へのメール送信・DM送信・電話営業・Instagram投稿・HP記事公開
- GitHub/Vercel/Supabase/Stripe等の外部アカウント作成、本番APIキー・銀行口座・決済情報の登録
- 売上・成約実績の保証や捏造

詳細は [SALES_PLAN.md](./SALES_PLAN.md) の「実行区分」を参照。
