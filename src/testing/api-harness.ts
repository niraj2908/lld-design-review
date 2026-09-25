import { GetProblem } from "@/application/use-cases/get-problem";
import { ListAttempts } from "@/application/use-cases/list-attempts";
import { ListProblems } from "@/application/use-cases/list-problems";
import { AskDesignCoach } from "@/application/use-cases/ask-design-coach";
import { CompareAttempts } from "@/application/use-cases/compare-attempts";
import type { DesignCoach } from "@/application/ports/design-coach";
import type { DesignEvaluator } from "@/application/ports/evaluator";
import type { ApiServices } from "@/presentation/api/handlers";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { GetAttempt } from "@/application/use-cases/get-attempt";
import { GetAttemptHistory } from "@/application/use-cases/get-attempt-history";
import { RetryEvaluation } from "@/application/use-cases/retry-evaluation";
import { SaveDraft } from "@/application/use-cases/save-draft";
import { StartAttempt } from "@/application/use-cases/start-attempt";
import { SubmitAttempt } from "@/application/use-cases/submit-attempt";
import type { Problem } from "@/domain/problem/problem";
import { FixedClock } from "./fixed-clock";
import { LEARNER_ID, parkingLotProblem } from "./fixtures";
import {
  InMemoryAttemptRepository,
  InMemoryEvaluationRepository,
  InMemoryProblemRepository,
  InMemorySubmissionRepository,
} from "./in-memory-repositories";
import { SequentialIdGenerator } from "./sequential-id-generator";

export interface ApiHarness {
  readonly services: ApiServices;
  readonly attempts: InMemoryAttemptRepository;
  readonly submissions: InMemorySubmissionRepository;
  readonly evaluations: InMemoryEvaluationRepository;
  readonly problem: Problem;
}

/**
 * The API layer wired to in-memory adapters.
 *
 * Handlers are exercised with real `Request` objects and assertions on real
 * `Response` status codes and bodies, so these are API tests rather than tests of a
 * mock. No database, no provider, no HTTP server.
 */
export function createApiHarness(
  options: {
    readonly problems?: readonly Problem[];
    readonly evaluator?: DesignEvaluator;
    /** `undefined` (the default) exercises the "no coach configured" path, same as a real environment with no model key. */
    readonly coach?: DesignCoach;
    readonly learnerId?: string;
  } = {},
): ApiHarness {
  const problem = options.problems?.[0] ?? parkingLotProblem();
  const problems = new InMemoryProblemRepository(
    options.problems ?? [problem],
  );
  const attempts = new InMemoryAttemptRepository();
  const submissions = new InMemorySubmissionRepository();
  const evaluations = new InMemoryEvaluationRepository();
  const clock = new FixedClock();
  const ids = new SequentialIdGenerator();
  const evaluator = options.evaluator ?? new RuleBasedEvaluator();

  const services: ApiServices = {
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
    compareAttempts: new CompareAttempts({
      attempts,
      problems,
      submissions,
      evaluations,
    }),
    askDesignCoach: new AskDesignCoach({
      attempts,
      problems,
      submissions,
      evaluations,
      coach: options.coach,
    }),
    evaluateAttempt: new EvaluateAttempt({
      attempts,
      problems,
      submissions,
      evaluations,
      evaluator,
      ids,
      clock,
    }),
    listProblems: new ListProblems(problems),
    getProblem: new GetProblem(problems),
    listAttempts: new ListAttempts({
      attempts,
      problems,
      submissions,
      evaluations,
    }),
    learnerId: options.learnerId ?? LEARNER_ID,
  };

  return { services, attempts, submissions, evaluations, problem };
}

/** A JSON request, as a route handler would receive it. */
export function jsonRequest(
  body: unknown,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Request {
  return new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function rawRequest(
  body: string,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Request {
  return new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json" },
    body,
  });
}

export async function readBody<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
