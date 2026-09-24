import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Integration tests need Postgres; they run via vitest.integration.config.mts.
    exclude: ["tests/integration/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/domain/**/*.ts",
        "src/application/**/*.ts",
        "src/infrastructure/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/testing/**",
        "src/infrastructure/persistence/prisma/client/**",
        "src/infrastructure/persistence/prisma/client",
      ],
    },
  },
});
