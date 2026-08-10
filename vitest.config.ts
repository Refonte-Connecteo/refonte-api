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
      ENCRYPTION_KEY:
        "f03f219f47271d43fcbd96e03c2f00e31005a63717a11eb252882d829205555b",
    },
  },
});
