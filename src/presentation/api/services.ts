import { GetProblem } from "@/application/use-cases/get-problem";
import { ListAttempts } from "@/application/use-cases/list-attempts";
import { ListProblems } from "@/application/use-cases/list-problems";
import {
  createKnowledgeServicesIfAvailable,
  createRepositories,
  createUseCases,
  createDefaultEvaluator,
} from "@/infrastructure/composition-root";
import { getPrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import type { PrismaClient } from "@/infrastructure/persistence/prisma/prisma-client";
import { SEED_LEARNER } from "@/infrastructure/persistence/seed/problem-catalogue";
import type { ApiServices } from "./handlers";

/**
 * Builds everything the API layer uses, from the composition root.
 *
 * This is the only place in the presentation layer that touches infrastructure
 * construction: no route handler, page or component builds a Prisma client, a
 * provider or a repository. The knowledge layer is assembled here too, so the judge
 * is grounded whenever a model is configured.
 */
export function createApiServices(
  prisma: PrismaClient,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ApiServices {
  const repositories = createRepositories(prisma);

  // Asked before building rather than caught afterwards: in production without an
  // embedding key there is no provider to make, and the whole application must not
  // fall over because the knowledge layer cannot be assembled. The review then runs
  // with no reference knowledge, which the prompt says out loud and the stored
  // evaluation records as `knowledgeVersion: not-applicable` — it never quietly
  // substitutes the local lexical embeddings that milestone 5 ruled out in production.
  // Which variables decide that is the composition root's business, not the API's.
  const knowledge = createKnowledgeServicesIfAvailable(prisma, env);

  const evaluator = createDefaultEvaluator(env, knowledge?.contextBuilder);
  const useCases = createUseCases(repositories, { evaluator });

  return {
    ...useCases,
    listProblems: new ListProblems(repositories.problems),
    getProblem: new GetProblem(repositories.problems),
    listAttempts: new ListAttempts({
      attempts: repositories.attempts,
      problems: repositories.problems,
      submissions: repositories.submissions,
      evaluations: repositories.evaluations,
    }),
    learnerId: SEED_LEARNER.id,
  };
}

/**
 * Cached for the life of the server process, like the Prisma client it wraps:
 * rebuilding the graph per request would open a pool per request in development.
 */
const globalForServices = globalThis as typeof globalThis & {
  designreviewApiServices?: ApiServices;
};

export function getApiServices(): ApiServices {
  globalForServices.designreviewApiServices ??= createApiServices(
    getPrismaClient(),
  );
  return globalForServices.designreviewApiServices;
}
