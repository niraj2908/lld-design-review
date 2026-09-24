import { GetAttempt } from "@/application/use-cases/get-attempt";
import { GetAttemptHistory } from "@/application/use-cases/get-attempt-history";
import { RetryEvaluation } from "@/application/use-cases/retry-evaluation";
import { SaveDraft } from "@/application/use-cases/save-draft";
import { StartAttempt } from "@/application/use-cases/start-attempt";
import { SubmitAttempt } from "@/application/use-cases/submit-attempt";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import { SystemClock } from "./clock/system-clock";
import { UuidIdGenerator } from "./id/uuid-id-generator";
import type { PrismaClient } from "./persistence/prisma/prisma-client";
import { PrismaAttemptRepository } from "./persistence/repositories/prisma-attempt-repository";
import { PrismaEvaluationRepository } from "./persistence/repositories/prisma-evaluation-repository";
import { PrismaProblemRepository } from "./persistence/repositories/prisma-problem-repository";
import { PrismaSubmissionRepository } from "./persistence/repositories/prisma-submission-repository";

export interface Repositories {
  readonly problems: PrismaProblemRepository;
  readonly attempts: PrismaAttemptRepository;
  readonly submissions: PrismaSubmissionRepository;
  readonly evaluations: PrismaEvaluationRepository;
}

export interface UseCases {
  readonly startAttempt: StartAttempt;
  readonly saveDraft: SaveDraft;
  readonly submitAttempt: SubmitAttempt;
  readonly getAttempt: GetAttempt;
  readonly getAttemptHistory: GetAttemptHistory;
  readonly retryEvaluation: RetryEvaluation;
}

export function createRepositories(prisma: PrismaClient): Repositories {
  return {
    problems: new PrismaProblemRepository(prisma),
    attempts: new PrismaAttemptRepository(prisma),
    submissions: new PrismaSubmissionRepository(prisma),
    evaluations: new PrismaEvaluationRepository(prisma),
  };
}

/**
 * The only place that knows both the use cases and the adapters that satisfy
 * their ports. Use cases receive interfaces, so swapping Prisma for another
 * store means editing this file and nothing above it.
 */
export function createUseCases(
  repositories: Repositories,
  dependencies: { readonly clock?: Clock; readonly ids?: IdGenerator } = {},
): UseCases {
  const clock = dependencies.clock ?? new SystemClock();
  const ids = dependencies.ids ?? new UuidIdGenerator();
  const { problems, attempts, submissions, evaluations } = repositories;

  return {
    startAttempt: new StartAttempt({ problems, attempts, ids, clock }),
    saveDraft: new SaveDraft({ attempts, problems, clock }),
    submitAttempt: new SubmitAttempt({
      attempts,
      problems,
      submissions,
      ids,
      clock,
    }),
    getAttempt: new GetAttempt({ attempts, problems, submissions, evaluations }),
    getAttemptHistory: new GetAttemptHistory({
      attempts,
      problems,
      submissions,
      evaluations,
    }),
    retryEvaluation: new RetryEvaluation({
      attempts,
      submissions,
      evaluations,
      clock,
    }),
  };
}
