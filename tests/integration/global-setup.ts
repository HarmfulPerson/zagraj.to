import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const TEST_DB_FILE = "test.db";
const root = path.resolve(import.meta.dirname, "../..");

function removeTestDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(path.join(root, TEST_DB_FILE + suffix), { force: true });
  }
}

/** Recreates the test database from migrations, so tests never touch dev.db. */
export default function setup() {
  removeTestDb();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:./${TEST_DB_FILE}` },
    stdio: "pipe",
  });
  return removeTestDb;
}
