import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL = "file:./test.db";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          // Separate SQLite file, recreated from migrations before the run; never dev.db.
          env: { DATABASE_URL: TEST_DATABASE_URL },
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
