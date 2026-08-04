# 運用マニュアル

## 日常運用(Day1時点の想定、実装が進み次第更新する)

- 新規顧客からの問い合わせ: [SALES_PLAN.md](./SALES_PLAN.md) の営業対象リストに追記し、無料診断フォーム(Day6〜実装)経由の問い合わせを一次対応する
- アカウント発行: 契約成立後、事業者(杉本土木)の管理者が対象企業の `Company` レコードと初期 `User`(ADMIN)を作成する(Day2で管理画面から実施できるようにする)
- 問い合わせ対応: FAQ([SALES_PLAN.md](./SALES_PLAN.md)内)を一次回答に使用し、解決しない場合は事業者が個別対応する

## 障害対応

1. エラーログ・操作ログ(`AuditLog`、デプロイ先のログ)を確認する
2. 影響範囲(全社/特定会社)を特定する — 会社間データ分離が機能していれば影響は基本的に単一 `companyId` に閉じる
3. 重大な障害の場合は [DEPLOYMENT.md](./DEPLOYMENT.md) のロールバック手順を実施する
4. 対応後、[CHANGELOG.md](./CHANGELOG.md) と [RISK_REGISTER.md](./RISK_REGISTER.md) に記録する

## サポート窓口(暫定)

事業者(杉本土木株式会社、shoma.s@sugidoboku.com)が一次窓口となる。専用サポートチャネル(LINE公式アカウント等)は優先度C機能として検討する。

## 定期メンテナンス

- 依存パッケージの脆弱性確認(`npm audit`)を週次で実施
- バックアップの復元テストを月次で実施([BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md))
