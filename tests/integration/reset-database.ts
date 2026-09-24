import { beforeEach, afterAll } from "vitest";
import { createTestPrismaClient } from "./test-database";

const prisma = createTestPrismaClient();

interface TableRow {
  readonly tablename: string;
}

/**
 * Every test starts from an empty database. Truncating is faster than a
 * transaction-per-test wrapper here, and it keeps the repository code under test
 * free of any test-only transaction plumbing.
 */
beforeEach(async () => {
  const tables = await prisma.$queryRaw<TableRow[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    return;
  }

  const quoted = tables.map((table) => `"public"."${table.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
