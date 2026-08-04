import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Dev: DATABASE_URL="file:./dev.db" (SQLite via libsql, no native build tools required).
// Prod: point DATABASE_URL at a hosted libsql/Turso or swap the adapter for Postgres
// (see ENVIRONMENT_VARIABLES.md) — Prisma 7 requires an explicit driver adapter.
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
