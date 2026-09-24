import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./client/client";

export type { PrismaClient } from "./client/client";

export interface PrismaClientOptions {
  readonly connectionString: string;
  readonly log?: boolean;
}

export function createPrismaClient(options: PrismaClientOptions): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: options.connectionString }),
    ...(options.log === true ? { log: ["query", "warn", "error"] } : {}),
  });
}

/**
 * Next.js reloads server modules on every edit in development, and each reload
 * would otherwise open a new pool until Postgres refuses connections. Caching
 * the client on `globalThis` survives the reload; in production the module is
 * evaluated once, so the cache is never consulted.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  designreviewPrisma?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and start Postgres with `npm run db:up`.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    return createPrismaClient({ connectionString });
  }

  globalForPrisma.designreviewPrisma ??= createPrismaClient({
    connectionString,
  });
  return globalForPrisma.designreviewPrisma;
}
