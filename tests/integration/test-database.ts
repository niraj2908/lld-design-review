import { existsSync } from "node:fs";
import { createPrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import type { PrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";

const ENV_FILE = new URL("../../.env", import.meta.url).pathname;

function loadEnvFileOnce(): void {
  if (process.env.TEST_DATABASE_URL === undefined && existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
}

export function testDatabaseUrl(): string {
  loadEnvFileOnce();
  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error(
      [
        "TEST_DATABASE_URL is not set, so the integration tests have no database to talk to.",
        "Run: cp .env.example .env && npm run db:up",
        "Then: npm run test:integration",
      ].join("\n"),
    );
  }
  return url;
}

export function createTestPrismaClient(): PrismaClient {
  return createPrismaClient({ connectionString: testDatabaseUrl() });
}
