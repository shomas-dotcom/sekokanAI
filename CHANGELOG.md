# Changelog

## Day 2〜5 + フリーミアム追加 — 2026-08-04

- Day2: 認証(DB裏付けセッション)、会社登録、顧客/案件管理(会社間データ分離)
- Day3: AI見積作成(自由記述/音声からの下書き、単価出所の明示)、明細編集、複製、印刷/PDF保存
- Day4: 音声入力による日報作成(構造化フィールドへの自動整理、認識不能項目の確認候補表示)
- Day5: 施工計画書下書き(17章、AIは文章整形のみ・内容は作り出さない、全章確認済みまで提出不可)
- デザインシステム刷新(indigo/violet→建設業らしいamber/orange基調に変更、AI関連要素のみindigo/violet)
- フリーミアム化: `Company.plan`(FREE/PREMIUM)を追加し、既存の見積・施工計画書機能をプレミアムゲート。`/premium`にAIプレミアム機能紹介画面(12機能、うち2機能利用可能・10機能は近日提供)を追加。デモ用プラン切替(実決済なし)
- 全機能の型チェック・本番ビルド・ブラウザでの回帰テスト実施(既存デモアカウントの動作継続を確認)

## Day 1 — 2026-08-04

- リポジトリ雛形作成(Next.js 16 + TypeScript + Tailwind CSS v4)
- Prismaスキーマ設計(Company/User/Customer/Project/Quote+QuoteItem/DailyReport/ConstructionPlan+ConstructionPlanSection/Template/AuditLog)、SQLite開発DB(libsqlドライバアダプタ)でマイグレーション適用
- パスワードハッシュユーティリティ(`src/lib/password.ts`, Node組み込みscrypt)
- デモシードスクリプト(`prisma/seed.ts`)、型チェック・本番ビルド確認済み
- 必須ドキュメント一式を作成([README.md](./README.md) のドキュメント一覧を参照)
- 市場調査(競合価格帯: ANDPAD, Concrew AI, nanoty等)を実施し [PRICING.md](./PRICING.md) に反映
