import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

export const DEFAULT_DATABASE_URL = "file:./dev.db";

/**
 * Creates a new PrismaClient backed by the better-sqlite3 driver adapter
 * (required by Prisma 7). App code should use the `prisma` singleton from
 * `lib/db.ts`; this factory is for scripts (seed) and tests.
 */
export function createPrismaClient(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}
