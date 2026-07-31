import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/helpers/test-db.ts";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    fileParallelism: false,
    hookTimeout: 120000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
    },
  },
});
