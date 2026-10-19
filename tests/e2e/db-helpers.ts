import { randomUUID } from "node:crypto";
import path from "node:path";

import Database from "better-sqlite3";
import { config } from "dotenv";

// Same database as the dev server started by Playwright (DATABASE_URL from .env.local, like prisma.config.ts).
// Plain better-sqlite3: Playwright's loader cannot import the generated (ESM) Prisma client.
config({ path: [".env.local", ".env"], quiet: true });

function openDb() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return new Database(path.resolve(process.cwd(), url.replace(/^file:/, "")));
}

function withDb<T>(fn: (db: Database.Database) => T): T {
  const db = openDb();
  db.pragma("busy_timeout = 5000");
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/** Prisma's SQLite DateTime format (ISO with an explicit +00:00 offset). */
const sqliteDate = (date: Date) => date.toISOString().replace("Z", "+00:00");

/**
 * Sets a DJ's plan (and optionally the renewal date) directly in the database. e2e runs without Stripe keys, so this
 * is how tests get a Pro account. The plan is read per request, so the logged-in session sees it on the next request.
 */
export function setDjPlan(email: string, plan: "FREE" | "PRO", planRenewsAt: Date | null = null): void {
  withDb((db) => {
    const { changes } = db
      .prepare(`UPDATE "User" SET "plan" = ?, "planRenewsAt" = ? WHERE "email" = ?`)
      .run(plan, planRenewsAt ? sqliteDate(planRenewsAt) : null, email);
    if (changes !== 1) throw new Error(`setDjPlan: no user ${email}`);
  });
}

/**
 * Adds `count` PENDING requests from made-up guests to the event with the given code (e.g. to fill a Free list).
 * `from` numbers the tracks, so a later call can add more without clashing with the earlier ones.
 */
export function seedRequests(code: string, count: number, from = 0): void {
  withDb((db) => {
    const event = db.prepare(`SELECT "id" FROM "Event" WHERE "code" = ?`).get(code) as { id: string } | undefined;
    if (!event) throw new Error(`seedRequests: no event ${code}`);
    const insert = db.prepare(
      `INSERT INTO "Request" ("id", "eventId", "trackId", "title", "artist", "status", "createdByGuestId", "createdAt")
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    );
    const base = Date.now() - (from + count) * 1000;
    db.transaction(() => {
      for (let i = from; i < from + count; i++) {
        const createdAt = sqliteDate(new Date(base + i * 1000));
        insert.run(randomUUID(), event.id, `seed-${i}`, `Utwór ${i + 1}`, "Wykonawca", `seed-guest-${i}`, createdAt);
      }
    })();
  });
}
