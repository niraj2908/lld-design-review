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
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    // Integration tests need Postgres; they run via vitest.integration.config.mts.
    exclude: ["tests/integration/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/app/_components/**/*.ts",
        "src/presentation/**/*.ts",
        "src/domain/**/*.ts",
        "src/application/**/*.ts",
        "src/infrastructure/**/*.ts",
        "src/evaluation-engine/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/testing/**",
        "src/infrastructure/persistence/prisma/client/**",
        "src/infrastructure/persistence/prisma/client",
      ],
    },
  },
});
