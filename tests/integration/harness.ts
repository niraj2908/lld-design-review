import { createRepositories, createUseCases } from "@/infrastructure/composition-root";
import type { Repositories, UseCases } from "@/infrastructure/composition-root";
import type { PrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import { seedDatabase } from "@/infrastructure/persistence/seed/seed-database";
import { SEED_LEARNER } from "@/infrastructure/persistence/seed/problem-catalogue";
import type { Problem } from "@/domain/problem/problem";
import { createTestPrismaClient } from "./test-database";

export const SEED_LEARNER_ID = SEED_LEARNER.id;

export interface IntegrationHarness {
  readonly prisma: PrismaClient;
  readonly repositories: Repositories;
  readonly useCases: UseCases;
}

export function createIntegrationHarness(): IntegrationHarness {
  const prisma = createTestPrismaClient();
  const repositories = createRepositories(prisma);
  return { prisma, repositories, useCases: createUseCases(repositories) };
}

export async function seedAndLoadProblem(
  harness: IntegrationHarness,
  slug = "parking-lot",
): Promise<Problem> {
  await seedDatabase(harness.prisma);
  const problem = await harness.repositories.problems.findBySlug(slug);
  if (problem === null) {
    throw new Error(`Seed did not create the "${slug}" problem.`);
  }
  return problem;
}
