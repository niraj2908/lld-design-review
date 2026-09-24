import {
  InMemoryAttemptRepository,
  InMemoryEvaluationRepository,
  InMemoryProblemRepository,
  InMemorySubmissionRepository,
} from "./in-memory-repositories";
import { FixedClock } from "./fixed-clock";
import { SequentialIdGenerator } from "./sequential-id-generator";
import { parkingLotProblem } from "./fixtures";
import type { DesignEvaluator } from "@/application/ports/evaluator";
import type { Problem } from "@/domain/problem/problem";
import { RuleBasedEvaluator } from "@/evaluation-engine/rule-based-evaluator";
import { EvaluateAttempt } from "@/application/use-cases/evaluate-attempt";
import { GetAttempt } from "@/application/use-cases/get-attempt";
import { GetAttemptHistory } from "@/application/use-cases/get-attempt-history";
import { RetryEvaluation } from "@/application/use-cases/retry-evaluation";
import { SaveDraft } from "@/application/use-cases/save-draft";
import { StartAttempt } from "@/application/use-cases/start-attempt";
import { SubmitAttempt } from "@/application/use-cases/submit-attempt";

export interface Harness {
  readonly problem: Problem;
  readonly problems: InMemoryProblemRepository;
  readonly attempts: InMemoryAttemptRepository;
  readonly submissions: InMemorySubmissionRepository;
  readonly evaluations: InMemoryEvaluationRepository;
  readonly clock: FixedClock;
  readonly ids: SequentialIdGenerator;
  readonly evaluator: DesignEvaluator;
  readonly startAttempt: StartAttempt;
  readonly evaluateAttempt: EvaluateAttempt;
  readonly saveDraft: SaveDraft;
  readonly submitAttempt: SubmitAttempt;
  readonly getAttempt: GetAttempt;
  readonly getAttemptHistory: GetAttemptHistory;
  readonly retryEvaluation: RetryEvaluation;
}

export function createHarness(
  problem: Problem = parkingLotProblem(),
  evaluator: DesignEvaluator = new RuleBasedEvaluator(),
): Harness {
  const problems = new InMemoryProblemRepository([problem]);
  const attempts = new InMemoryAttemptRepository();
  const submissions = new InMemorySubmissionRepository();
  const evaluations = new InMemoryEvaluationRepository();
  const clock = new FixedClock();
  const ids = new SequentialIdGenerator();

  return {
    problem,
    problems,
    attempts,
    submissions,
    evaluations,
    clock,
    ids,
    evaluator,
    startAttempt: new StartAttempt({ problems, attempts, ids, clock }),
    evaluateAttempt: new EvaluateAttempt({
      attempts,
      problems,
      submissions,
      evaluations,
      evaluator,
      ids,
      clock,
    }),
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
