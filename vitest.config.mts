import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Integration tests share one real Postgres DB (kick_test) and reset it
    // between tests — they must NOT run in parallel or they race on shared rows.
    fileParallelism: false,
  },
});
