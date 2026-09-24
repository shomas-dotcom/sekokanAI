# 試験用データベース(このパソコンの中だけで動く)

本番(Neon)に触れずに、画面・保存処理・権限・移行SQLを確かめるための道具です。
無料・アカウント不要。中身は PGlite(PostgreSQLをNode.jsの中で動かす部品)です。

## 最初の1回だけ

```
cd tools/test-db
npm install
```

## 使い方

1. 試験用DBを起動する(止めるときは Ctrl+C)
   `node tools/test-db/start.mjs`
2. 別の画面で、保存項目を最新にし、お試しデータを入れる(PowerShellの例)
   ```
   $env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable"
   npx prisma migrate deploy
   npx tsx prisma/seed.ts
   npx tsx prisma/seedPlans.ts
   npx tsx tools/test-db/seed-test-users.ts
   ```
3. アプリを試験用DBにつないで起動する → http://localhost:3100
   `node tools/test-db/dev.mjs`

中身を全部消して作り直すときは `node tools/test-db/start.mjs --reset`。

## 試験用アカウント(架空・試験用DB専用)

| メール | 役割 |
|---|---|
| demo@genba-ai.local | デモ会社の管理者(パスワードは prisma/seed.ts 参照) |
| member@genba-ai.local | デモ会社の一般社員(田中に紐付け) |
| manager@genba-ai.local | デモ会社の現場責任者 |
| admin-b@genba-ai.local | B社の管理者(会社分離の確認用) |

seed-test-users.ts で作ったアカウントのパスワードは `test-password-1234`。

## 注意

- `dev.mjs` はメール・AI・課金・Googleログインのキーを空にして起動します(本物の送信・課金をしない)。
- `seed-test-users.ts`・`issue-session.ts`・`inspect.ts` は、接続先が 127.0.0.1 以外なら止まります。
- `.env` の接続先は本番です。`npm run dev` をそのまま使うと本番DBにつながるので注意してください。
- 試験用DBは PostgreSQL と同じ動きをしますが、同時接続の扱いなど細部は本物と違う場合があります。
  30社の同時利用の試験(負荷試験)には使えません。
