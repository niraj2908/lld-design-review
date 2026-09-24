import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database";

/**
 * Applies the checked-in migrations to the test database once per run, using the
 * same `migrate deploy` path a deployment would use. Nothing here creates schema
 * by hand, so a wrong migration fails the run rather than passing against an
 * invented schema.
 */
export default function setup(): void {
  const url = testDatabaseUrl();

  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (cause) {
    throw new Error(
      [
        "Could not migrate the integration-test database.",
        "These tests need the local PostgreSQL container from docker-compose.yml:",
        "  cp .env.example .env   # once",
        "  npm run db:up",
        "  npm run test:integration",
      ].join("\n"),
      { cause },
    );
  }
}
