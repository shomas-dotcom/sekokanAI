import "dotenv/config"; // Next.js経由(next dev/build/start)では既に読み込まれているが、
// prisma/seed.ts等をtsxで直接実行する場合はここで読み込まないとDATABASE_URLが
// 空のままPostgresへの接続を試みてしまう(ローカルの意図しないポートへ接続しようとして
// ECONNREFUSEDになる)。既に読み込み済みの環境変数を上書きすることはない。
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Postgres(Neon等)。Prisma 7は明示的なドライバアダプタが必須。
// 2026-08-27にSQLite(libsql)から移行した(ENVIRONMENT_VARIABLES.md, DEPLOYMENT.md参照)。
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
