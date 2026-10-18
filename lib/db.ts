import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db-client";

// Keep a single client across hot reloads in development (Next.js re-evaluates
// modules on every change, which would otherwise open a new connection each time).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
