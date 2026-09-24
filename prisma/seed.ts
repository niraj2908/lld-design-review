import { createPrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import { seedDatabase } from "@/infrastructure/persistence/seed/seed-database";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, then run `npm run db:up`.",
    );
  }

  const prisma = createPrismaClient({ connectionString });
  try {
    const result = await seedDatabase(prisma);
    process.stdout.write(
      `Seeded ${result.problems} problems, ${result.requirements} requirements, ${result.learners} learner.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Seeding failed: ${String(error)}\n`);
  process.exitCode = 1;
});
