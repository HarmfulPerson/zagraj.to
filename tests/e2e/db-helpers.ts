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

/**
 * Sets a DJ's plan directly in the database. Billing (Stripe) is ticket 012; until then this is the only way to get a
 * Pro account in e2e. The plan is read per request, so the logged-in session sees the change on the next request.
 */
export function setDjPlan(email: string, plan: "FREE" | "PRO"): void {
  withDb((db) => {
    const { changes } = db.prepare(`UPDATE "User" SET "plan" = ? WHERE "email" = ?`).run(plan, email);
    if (changes !== 1) throw new Error(`setDjPlan: no user ${email}`);
  });
}

/** Adds `count` PENDING requests from made-up guests to the event with the given code (e.g. to fill a Free list). */
export function seedRequests(code: string, count: number): void {
  withDb((db) => {
    const event = db.prepare(`SELECT "id" FROM "Event" WHERE "code" = ?`).get(code) as { id: string } | undefined;
    if (!event) throw new Error(`seedRequests: no event ${code}`);
    const insert = db.prepare(
      `INSERT INTO "Request" ("id", "eventId", "trackId", "title", "artist", "status", "createdByGuestId", "createdAt")
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    );
    const base = Date.now() - count * 1000;
    db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const createdAt = new Date(base + i * 1000).toISOString().replace("Z", "+00:00");
        insert.run(randomUUID(), event.id, `seed-${i}`, `Utwór ${i + 1}`, "Wykonawca", `seed-guest-${i}`, createdAt);
      }
    })();
  });
}
