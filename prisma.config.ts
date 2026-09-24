import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads `.env` implicitly. Loading it here keeps the CLI and
// the application reading the same file, so `npm run db:migrate` and the running
// app can never disagree about which database they are pointed at.
const ENV_FILE = new URL(".env", import.meta.url).pathname;
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

// `datasource` is omitted rather than left empty when no URL is configured, so
// `prisma generate` still works on a fresh clone with no `.env`, while the
// migration commands fail with Prisma's own message about a missing datasource.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
  ...(url === undefined || url.length === 0 ? {} : { datasource: { url } }),
});
