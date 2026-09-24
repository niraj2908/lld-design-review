import type { PrismaClient } from "../prisma/prisma-client";
import { SEED_LEARNER, SEED_PROBLEMS } from "./problem-catalogue";

export interface SeedResult {
  readonly learners: number;
  readonly problems: number;
  readonly requirements: number;
}

/**
 * Deterministic and safe to rerun: every row has a stable id, so this upserts
 * rather than inserts, and requirements and rubric criteria are replaced wholesale
 * so that editing the catalogue cannot leave a stale requirement behind.
 *
 * Attempts, submissions and evaluations are never touched — reseeding must not
 * destroy practice history.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<SeedResult> {
  const now = new Date("2026-01-01T00:00:00.000Z");

  await prisma.learner.upsert({
    where: { id: SEED_LEARNER.id },
    create: { id: SEED_LEARNER.id, displayName: SEED_LEARNER.displayName },
    update: { displayName: SEED_LEARNER.displayName },
  });

  let requirementCount = 0;

  for (const problem of SEED_PROBLEMS) {
    await prisma.$transaction(async (tx) => {
      await tx.problem.upsert({
        where: { id: problem.id },
        create: {
          id: problem.id,
          slug: problem.slug,
          title: problem.title,
          description: problem.description,
          context: problem.context,
          constraints: [...problem.constraints],
          acceptedSubmissionFormats: ["STRUCTURED_DESIGN"],
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          slug: problem.slug,
          title: problem.title,
          description: problem.description,
          context: problem.context,
          constraints: [...problem.constraints],
          acceptedSubmissionFormats: ["STRUCTURED_DESIGN"],
          updatedAt: now,
        },
      });

      for (const [position, requirement] of problem.requirements.entries()) {
        const id = requirementId(problem.id, requirement.code);
        await tx.requirement.upsert({
          where: { id },
          create: {
            id,
            problemId: problem.id,
            code: requirement.code,
            title: requirement.title,
            description: requirement.description,
            priority: requirement.priority,
            position,
          },
          update: {
            code: requirement.code,
            title: requirement.title,
            description: requirement.description,
            priority: requirement.priority,
            position,
          },
        });
        requirementCount += 1;
      }

      // A requirement removed from the catalogue must disappear, but only if no
      // stored design still references it.
      await tx.requirement.deleteMany({
        where: {
          problemId: problem.id,
          id: {
            notIn: problem.requirements.map((requirement) =>
              requirementId(problem.id, requirement.code),
            ),
          },
          requirementMappings: { none: {} },
        },
      });

      const rubric = await tx.problemRubric.upsert({
        where: { problemId: problem.id },
        create: { problemId: problem.id, version: problem.rubricVersion },
        update: { version: problem.rubricVersion },
        select: { id: true },
      });

      await tx.rubricCriterion.deleteMany({ where: { rubricId: rubric.id } });
      await tx.rubricCriterion.createMany({
        data: problem.rubricCriteria.map((criterion, position) => ({
          rubricId: rubric.id,
          criterion: criterion.criterion,
          weight: criterion.weight,
          guidance: criterion.guidance,
          position,
        })),
      });
    });
  }

  return {
    learners: 1,
    problems: SEED_PROBLEMS.length,
    requirements: requirementCount,
  };
}

function requirementId(problemId: string, code: string): string {
  return `req_${problemId.replace(/^prb_/, "")}_${code.toLowerCase().replaceAll("-", "_")}`;
}
