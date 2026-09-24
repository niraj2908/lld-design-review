import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import { InvalidAttemptStateError } from "@/domain/shared/errors";
import {
  AttemptNotFoundError,
  EvaluationNotFoundError,
  SubmissionNotFoundError,
} from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { Clock } from "../ports/clock";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface RetryEvaluationInput {
  readonly attemptId: string;
}

export interface RetryEvaluationResult {
  readonly attemptId: string;
  readonly submissionId: string;
  readonly evaluationId: string;
  readonly idempotencyKey: string;
  readonly attemptStatus: AttemptStatus;
  readonly evaluationStatus: EvaluationStatus;
}

export interface RetryEvaluationDeps {
  readonly attempts: AttemptRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
  readonly clock: Clock;
}

/**
 * State-only for this milestone: it re-opens the failed evaluation and moves the
 * attempt back to EVALUATING. Handing the request to an EvaluationDispatcher is
 * the next milestone's job, which is why the submission is never rewritten here.
 */
export class RetryEvaluation {
  constructor(private readonly deps: RetryEvaluationDeps) {}

  async execute(input: RetryEvaluationInput): Promise<RetryEvaluationResult> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    if (attempt.status !== "FAILED") {
      throw new InvalidAttemptStateError({
        attemptId: attempt.id,
        from: attempt.status,
        to: "EVALUATING",
        operation: "retryEvaluation",
      });
    }

    const submission = await this.deps.submissions.findLatestByAttemptId(
      attempt.id,
    );
    if (submission === null) {
      throw new SubmissionNotFoundError(attempt.id);
    }

    const evaluation = await this.deps.evaluations.findLatestBySubmissionId(
      submission.id,
    );
    if (evaluation === null) {
      throw new EvaluationNotFoundError(submission.id);
    }

    const now = this.deps.clock.now();

    // Retry reuses the same evaluation record, so the failure history and the
    // idempotency key stay attached to one submission version.
    evaluation.start(now);
    await this.deps.evaluations.update(evaluation);

    attempt.markEvaluating(now);
    await this.deps.attempts.update(attempt);

    return {
      attemptId: attempt.id,
      submissionId: submission.id,
      evaluationId: evaluation.id,
      idempotencyKey: evaluation.idempotencyKey,
      attemptStatus: attempt.status,
      evaluationStatus: evaluation.status,
    };
  }
}
