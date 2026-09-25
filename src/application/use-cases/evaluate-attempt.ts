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
  EvaluationInProgressError,
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
 *
 * Idempotency and concurrency are handled at three separate points, because a
 * duplicate or racing request can arrive at three different moments:
 *
 * 1. Before this invocation ever writes anything — `findByIdempotencyKey`
 *    already caught this for a completed evaluation; a fresh row is only
 *    created when none of the right shape exists yet.
 * 2. While this invocation is creating that fresh row — `createOrJoinEvaluation`
 *    handles a concurrent request that created the same idempotency-keyed row
 *    microseconds earlier, by re-reading rather than guessing.
 * 3. After the evaluator has already succeeded — `failIfStillFailable` never
 *    lets a later, unrelated failure (an attempt-status write, say) reach the
 *    evaluation's own state machine once that evaluation is genuinely
 *    `COMPLETED`, whether this invocation completed it or another one did.
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
      return this.reusedResult(attempt, submission, existing, idempotencyKey);
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
      const stored = await this.createOrJoinEvaluation(evaluation);
      if (stored.id !== evaluation.id) {
        // A concurrent request's row won the race to be created. It is either
        // already done — the normal idempotency check above just missed it by
        // microseconds — or still running; either way, this request does not
        // also run the evaluator, which would waste a call and reintroduce the
        // exact race this check exists to avoid.
        if (stored.status === "COMPLETED") {
          return this.reusedResult(attempt, submission, stored, idempotencyKey);
        }
        throw new EvaluationInProgressError({
          attemptId: attempt.id,
          evaluationId: stored.id,
        });
      }
    } else {
      await this.deps.evaluations.update(evaluation);
    }

    if (attempt.status === "SUBMITTED") {
      attempt.markEvaluating(now);
      await this.deps.attempts.update(attempt);
    }

    let outcome;
    try {
      outcome = await this.deps.evaluator.evaluate({ problem, submission });
    } catch (cause) {
      await this.failIfStillFailable(attempt, evaluation, cause);
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

    // The evaluator succeeded. Completing the evaluation and completing the
    // attempt are two separate writes from here on, deliberately: a failure in
    // the second must never be allowed to fail the first back — the evaluation
    // itself genuinely succeeded, and `failIfStillFailable` is what keeps that
    // true regardless of which of the two steps below actually fails.
    evaluation.complete(outcome, this.deps.clock.now());
    try {
      await this.deps.evaluations.update(evaluation);
    } catch (cause) {
      // Ambiguous on its own: the write may have failed outright, or it may have
      // committed and only the confirmation was lost (a dropped connection after
      // commit is indistinguishable from one before it). Asking the database
      // settles it instead of guessing either way.
      const persisted = await this.deps.evaluations.findById(evaluation.id);
      if (persisted === null || persisted.status !== "COMPLETED") {
        await this.failIfStillFailable(attempt, evaluation, cause);
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
      // The write actually landed — proceed as a success.
    }

    await this.syncAttemptCompletion(attempt);

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

  private reusedResult(
    attempt: Attempt,
    submission: { readonly id: string; readonly version: number },
    evaluation: Evaluation,
    idempotencyKey: string,
  ): EvaluateAttemptResult {
    return {
      attemptId: attempt.id,
      submissionId: submission.id,
      submissionVersion: submission.version,
      evaluationId: evaluation.id,
      evaluationStatus: evaluation.status,
      attemptStatus: attempt.status,
      idempotencyKey,
      reused: true,
      retrievedKnowledgeCount:
        evaluation.outcome?.knowledgeCitations?.length ?? 0,
    };
  }

  /**
   * Creates the evaluation row, or — if a concurrent request created the same
   * idempotency-keyed row first — returns that row instead of failing. The
   * repository's unique constraint on `idempotencyKey` is what makes this safe:
   * at most one row can ever exist for a given attempt, submission version and
   * evaluator, so re-reading after a failed create can only ever find that same
   * one row, never a different, unrelated one.
   */
  private async createOrJoinEvaluation(
    evaluation: Evaluation,
  ): Promise<Evaluation> {
    try {
      await this.deps.evaluations.save(evaluation);
      return evaluation;
    } catch (saveError) {
      const winner = await this.deps.evaluations.findByIdempotencyKey(
        evaluation.idempotencyKey,
      );
      if (winner === null) {
        // The save failed for a reason unrelated to a concurrent create — there
        // is nothing to join, so the original failure is what the caller needs.
        throw saveError;
      }
      return winner;
    }
  }

  /**
   * Moves the attempt to COMPLETED, tolerating the two safe reasons it might
   * already be there or unreachable: another invocation already advanced it (the
   * evaluation it raced on is the same one this call just confirmed COMPLETED,
   * so nothing here is masking a real problem), or the write itself failed. The
   * latter is logged, not thrown — the evaluation is already correctly
   * COMPLETED and persisted by this point, and a later read of the attempt will
   * self-heal this on its own the next time anything touches it, so a
   * mismatched attempt status for a short window is a lesser, honest cost than
   * telling the learner their genuinely successful evaluation failed.
   */
  private async syncAttemptCompletion(attempt: Attempt): Promise<void> {
    if (attempt.status !== "EVALUATING") {
      return;
    }
    try {
      attempt.markCompleted(this.deps.clock.now());
      await this.deps.attempts.update(attempt);
    } catch (cause) {
      // eslint-disable-next-line no-console -- safe, narrow diagnostics: no learner data, no secret, just that a follow-up write did not land.
      console.error(
        `[evaluate-attempt] attempt ${attempt.id} could not be marked COMPLETED after its evaluation succeeded`,
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }

  /**
   * Fails `evaluation` only if it is genuinely still in a state that allows
   * it — re-read fresh from storage, never trusted from memory, because a
   * concurrent invocation may have completed this exact row since this one
   * last saw it. The original `cause` is preserved as the evaluation's own
   * failure detail when the transition is safe, and logged (never silently
   * dropped) when it is not, so a suppressed failure is still diagnosable.
   */
  private async failIfStillFailable(
    attempt: Attempt,
    evaluation: Evaluation,
    cause: unknown,
  ): Promise<void> {
    const current = await this.deps.evaluations.findById(evaluation.id);
    if (current === null || current.status === "COMPLETED") {
      // eslint-disable-next-line no-console -- safe, narrow diagnostics: no learner data, no secret, just the class/message of a suppressed failure.
      console.error(
        `[evaluate-attempt] evaluation ${evaluation.id} failed after it was already completed (by this or another invocation); leaving it COMPLETED`,
        cause instanceof Error ? cause.message : String(cause),
      );
      return;
    }

    const failedAt = this.deps.clock.now();
    current.fail(
      {
        code: "EVALUATOR_FAILED",
        message: cause instanceof Error ? cause.message : String(cause),
      },
      failedAt,
    );
    await this.deps.evaluations.update(current);

    // Only ever the transition this evaluator's own failure implies: an attempt
    // already COMPLETED (by the same race that left the evaluation COMPLETED
    // above) or already FAILED is left exactly as it is, never re-failed.
    const currentAttempt = await this.deps.attempts.findById(attempt.id);
    if (currentAttempt !== null && currentAttempt.status === "EVALUATING") {
      currentAttempt.markFailed(failedAt);
      await this.deps.attempts.update(currentAttempt);
    }
  }
}
