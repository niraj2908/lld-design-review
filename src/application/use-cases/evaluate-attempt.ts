import type { Attempt } from "@/domain/attempt/attempt";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import { Evaluation } from "@/domain/evaluation/evaluation";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import {
  NOT_APPLICABLE_VERSION,
  buildEvaluationIdempotencyKey,
} from "@/domain/evaluation/evaluation-versions";
import { InvalidAttemptStateError } from "@/domain/shared/errors";
import {
  AttemptNotFoundError,
  EvaluationExecutionError,
  ProblemNotFoundError,
  SubmissionNotFoundError,
} from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { Clock } from "../ports/clock";
import type { DesignEvaluator } from "../ports/evaluator";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { IdGenerator } from "../ports/id-generator";
import { ID_PREFIXES } from "../ports/id-generator";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

/** Attempt states an evaluation may start from. */
const EVALUABLE_STATUSES: readonly AttemptStatus[] = [
  // The normal path: the learner has just submitted.
  "SUBMITTED",
  // RetryEvaluation has already moved a failed attempt back here.
  "EVALUATING",
];

export interface EvaluateAttemptInput {
  readonly attemptId: string;
}

export interface EvaluateAttemptResult {
  readonly attemptId: string;
  readonly submissionId: string;
  readonly submissionVersion: number;
  readonly evaluationId: string;
  readonly evaluationStatus: EvaluationStatus;
  readonly attemptStatus: AttemptStatus;
  readonly idempotencyKey: string;
  /** True when a completed evaluation already existed and was returned unchanged. */
  readonly reused: boolean;
  /**
   * How many reference-knowledge passages informed the semantic review. Reported
   * rather than logged: the caller decides what to do with it, and the same numbers
   * are on the stored evaluation for anyone asking later.
   */
  readonly retrievedKnowledgeCount: number;
}

export interface EvaluateAttemptDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
  readonly evaluator: DesignEvaluator;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/**
 * Runs an evaluator over a submission that is already stored.
 *
 * Synchronous on purpose for now. An `EvaluationDispatcher` will sit in front of
 * this later; putting the work here first keeps the lifecycle, the failure path
 * and the idempotency rule testable without any queue.
 */
export class EvaluateAttempt {
  constructor(private readonly deps: EvaluateAttemptDeps) {}

  async execute(input: EvaluateAttemptInput): Promise<EvaluateAttemptResult> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    if (!EVALUABLE_STATUSES.includes(attempt.status)) {
      throw new InvalidAttemptStateError({
        attemptId: attempt.id,
        from: attempt.status,
        to: "EVALUATING",
        operation: "evaluate",
      });
    }

    // The evaluator reads a stored snapshot, never the live draft.
    const submission = await this.deps.submissions.findLatestByAttemptId(
      attempt.id,
    );
    if (submission === null) {
      throw new SubmissionNotFoundError(attempt.id);
    }

    const problem = await this.deps.problems.findById(attempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(attempt.problemId);
    }

    const evaluatorVersion = this.deps.evaluator.version;
    const metadata = this.deps.evaluator.metadata ?? {};
    const idempotencyKey = buildEvaluationIdempotencyKey({
      attemptId: attempt.id,
      submissionVersion: submission.version,
      evaluatorVersion,
    });

    const existing =
      await this.deps.evaluations.findByIdempotencyKey(idempotencyKey);

    // Same attempt, same submission version, same evaluator: the answer cannot
    // differ, so a repeated request returns the stored one instead of rewriting it.
    if (existing !== null && existing.status === "COMPLETED") {
      return {
        attemptId: attempt.id,
        submissionId: submission.id,
        submissionVersion: submission.version,
        evaluationId: existing.id,
        evaluationStatus: existing.status,
        attemptStatus: attempt.status,
        idempotencyKey,
        reused: true,
        retrievedKnowledgeCount:
          existing.outcome?.knowledgeCitations?.length ?? 0,
      };
    }

    const now = this.deps.clock.now();
    const evaluation =
      existing ??
      Evaluation.request({
        id: this.deps.ids.generate(ID_PREFIXES.evaluation),
        submissionId: submission.id,
        versions: {
          evaluatorVersion,
          rubricVersion: problem.rubric.version,
          promptVersion: metadata.promptVersion ?? NOT_APPLICABLE_VERSION,
          knowledgeVersion: NOT_APPLICABLE_VERSION,
          ...(metadata.provider === undefined
            ? {}
            : { provider: metadata.provider }),
          ...(metadata.model === undefined ? {} : { model: metadata.model }),
        },
        idempotencyKey,
        now,
      });

    if (evaluation.status !== "EVALUATING") {
      evaluation.start(now);
    }

    // Recorded as running before the evaluator is invoked, so a process that dies
    // mid-run leaves a retryable row rather than no trace.
    if (existing === null) {
      await this.deps.evaluations.save(evaluation);
    } else {
      await this.deps.evaluations.update(evaluation);
    }

    if (attempt.status === "SUBMITTED") {
      attempt.markEvaluating(now);
      await this.deps.attempts.update(attempt);
    }

    try {
      const outcome = await this.deps.evaluator.evaluate({
        problem,
        submission,
      });
      evaluation.complete(outcome, this.deps.clock.now());
      await this.deps.evaluations.update(evaluation);

      attempt.markCompleted(this.deps.clock.now());
      await this.deps.attempts.update(attempt);
    } catch (cause) {
      await this.recordFailure(attempt, evaluation, cause);
      throw new EvaluationExecutionError(
        {
          attemptId: attempt.id,
          submissionId: submission.id,
          evaluationId: evaluation.id,
          evaluatorVersion,
        },
        cause,
      );
    }

    return {
      attemptId: attempt.id,
      submissionId: submission.id,
      submissionVersion: submission.version,
      evaluationId: evaluation.id,
      evaluationStatus: evaluation.status,
      attemptStatus: attempt.status,
      idempotencyKey,
      reused: false,
      retrievedKnowledgeCount:
        evaluation.outcome?.knowledgeCitations?.length ?? 0,
    };
  }

  /**
   * The submission is never touched: a failed evaluator is an infrastructure
   * outcome, and the learner's work has to survive it.
   */
  private async recordFailure(
    attempt: Attempt,
    evaluation: Evaluation,
    cause: unknown,
  ): Promise<void> {
    const failedAt = this.deps.clock.now();
    evaluation.fail(
      {
        code: "EVALUATOR_FAILED",
        message: cause instanceof Error ? cause.message : String(cause),
      },
      failedAt,
    );
    await this.deps.evaluations.update(evaluation);

    attempt.markFailed(failedAt);
    await this.deps.attempts.update(attempt);
  }
}
