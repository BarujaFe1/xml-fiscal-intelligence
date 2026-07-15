import { defineConfig } from "vitest/config";
import path from "path";

// Standalone config for the LIVE Postgres RLS behavioral suite.
// Kept fully independent from tests/unit (vitest.config.ts).
// Run with: npm run test:rls   (skipped by default — see tests/rls/real-rls.test.ts)
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 60000,
    // Sequential execution (concurrency 1). vitest's API name for this is
    // maxConcurrency (under test).
    maxConcurrency: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
