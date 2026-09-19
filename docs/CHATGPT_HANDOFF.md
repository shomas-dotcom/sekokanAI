# ChatGPT引き継ぎメモ

ChatGPT・Claude Code・Codexの3つのAIで開発を進めるための、共通の前提情報。

## 現場AIの概要

建設業(土木・外構・造成・舗装)向けAI業務改善パッケージ。杉本土木株式会社が自社の施工管理経験をもとに開発している、初期導入型の受託販売SaaS雛形。見積作成・音声入力・日報作成・施工計画書下書き・顧客/案件管理・工事請負契約書・請求書をひとつにまとめ、現場からスマートフォンで完結させることを目指す。

詳細は [README.md](../README.md)、事業計画は [PROJECT_PLAN.md](../PROJECT_PLAN.md) を参照。

## 使用技術

- Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- Prisma 7 + Postgres(`@prisma/adapter-pg`経由。開発・本番ともNeon等のクラウドPostgres)
- 認証: 自前実装(scryptパスワードハッシュ・Cookieセッション。Auth.js等の外部ライブラリは未使用)
- AI: 抽象化レイヤー経由。`AI_API_KEY`未設定時はモック応答で動作([ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md))

## GitHubリポジトリ

<https://github.com/shomas-dotcom/sekokanAI.git>

`main`が本番の元。作業は必ず作業用ブランチ(`feature/xxx`、`chore/xxx`等)を切って行い、`main`へ直接pushしない。

## Renderとの関係

[render.yaml](../render.yaml)にRender Blueprintを定義済み。Renderの「New +」→「Blueprint」からこのリポジトリを選ぶと、この設定でサービスが自動作成される。

- ビルド時に`prisma generate && prisma migrate deploy`を実行してから`next build`
- `DATABASE_URL`・`AI_API_KEY`・`STRIPE_SECRET_KEY`等の秘密情報は`sync: false`にしており、リポジトリには書かず、Renderのダッシュボード側で入力する
- 詳細な手順は[DEPLOYMENT.md](../DEPLOYMENT.md)を参照

## 開発中の主な機能(README.mdより)

- 会社情報登録・顧客管理・案件管理(工事番号自動採番)
- 見積書(AI下書き・明細編集・印刷/PDF保存)
- 工事請負契約書(見積からの金額反映・DOCX/印刷出力)
- 請求書(出来高/分割請求対応、残額整合性チェック)
- 日報(音声入力)・施工計画書下書き
- 案件詳細の簡易工事台帳

## ChatGPTからClaude Codeへ渡す方法

1. ChatGPTで要望を整理し、[TASK_TEMPLATE.md](./ai-tasks/TASK_TEMPLATE.md)を複製して`docs/ai-tasks/`配下に1件の作業指示ファイルを作る
2. 結論・理由・対象者・操作の流れ・入力項目・出力/集計・受入条件を埋める
3. そのファイルの内容(またはパス)をClaude Codeに渡す。Claude Codeは専用の作業ブランチで実装し、完了したら変更内容・テスト結果・残る注意点を同じファイルの「実装結果」欄に追記する

詳細な流れは[AI_WORKFLOW.md](./AI_WORKFLOW.md)を参照。

## Claude CodeからCodexへ検査を引き継ぐ方法

1. Claude Codeが実装を終えたら、変更内容と使用したブランチ名を明記する
2. Codexに検査を依頼する(`/codex:review`等)
3. Codexは次を確認する
   - 指示どおり動くか
   - 他の機能を壊していないか
   - 社員間の同期が正しいか
   - 他社のデータが混ざっていないか
   - スマートフォンでも操作できるか

## 作業結果をChatGPTへ戻す報告形式

次の順で、日本語・専門用語には一言の言い換えを添えて報告する(プロジェクトの[CLAUDE.md](../CLAUDE.md)のルールに準拠)。

1. 結論(3行以内)
2. 理由
3. 次にやること
4. 杉本さんに決めてほしいこと

## パスワードや個人情報を書かないルール

- パスワード、APIキー、トークン、本番の接続文字列は、このリポジトリのどのファイルにも書かない。秘密情報は`.env`のみで管理し、`.env`はgit管理外(`.gitignore`で除外済み)
- 顧客・社員の氏名/連絡先等の個人情報は、作業指示書やドキュメントに直接書かず、必要な場合はテスト用の仮名・ダミー値を使う
- 秘密情報や個人情報らしきものを見つけた場合は、内容を画面へ表示・出力せず、ファイル名と対応方法だけを報告する
