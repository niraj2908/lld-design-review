import type { AttemptComparison } from "@/domain/comparison/attempt-comparison";
import { buildAttemptComparison } from "@/domain/comparison/attempt-comparison";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import type { Attempt } from "@/domain/attempt/attempt";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import type { FeedbackItem } from "@/domain/feedback/feedback-item";
import {
  AttemptNotFoundError,
  InvalidComparisonError,
  ProblemNotFoundError,
} from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface CompareAttemptsInput {
  readonly attemptAId: string;
  readonly attemptBId: string;
  /** The requesting learner, checked against both attempts before anything loads. */
  readonly learnerId: string;
}

export interface ComparedAttemptSummary {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly hasSubmission: boolean;
  readonly submissionVersion: number | null;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly hasCompletedEvaluation: boolean;
  readonly createdAt: Date;
  readonly submittedAt: Date | null;
}

export interface CompareAttemptsResult {
  readonly problem: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
  };
  /** The chronologically earlier of the two attempts, whichever order they were requested in. */
  readonly earlier: ComparedAttemptSummary;
  /** The chronologically later attempt — what `earlier` evolved into. */
  readonly later: ComparedAttemptSummary;
  readonly comparison: AttemptComparison;
  /**
   * The earlier attempt's own findings, in the same order as
   * `comparison.feedbackResolutions` — each resolution is a judgement about the
   * item at the same index here, so a caller that wants to show "previous concern
   * → structural change → current state" has both halves without a second lookup.
   */
  readonly earlierFeedback: readonly FeedbackItem[];
}

export interface CompareAttemptsDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
}

/**
 * Design evolution between two of a learner's own attempts at the same problem.
 *
 * Ordering is by attempt number, not by which id was passed as `attemptAId` —
 * comparing attempt 2 against attempt 1 and comparing attempt 1 against attempt 2
 * describe the same evolution and must read as the same "attempt 1 → attempt 2"
 * story either way, rather than silently flipping before and after depending on
 * argument order.
 *
 * Every read here goes through a repository and every guard runs before any
 * comparison logic executes: ownership, same-problem, not-the-same-attempt.
 * Comparison itself is entirely the pure `buildAttemptComparison` from the
 * domain — this use case's job is exclusively steps 1 through 5 of loading and
 * verifying, then handing off.
 */
export class CompareAttempts {
  constructor(private readonly deps: CompareAttemptsDeps) {}

  async execute(input: CompareAttemptsInput): Promise<CompareAttemptsResult> {
    if (input.attemptAId === input.attemptBId) {
      throw new InvalidComparisonError({
        reason: "SAME_ATTEMPT",
        attemptAId: input.attemptAId,
        attemptBId: input.attemptBId,
      });
    }

    const attemptA = await this.loadOwned(input.attemptAId, input.learnerId);
    const attemptB = await this.loadOwned(input.attemptBId, input.learnerId);

    if (attemptA.problemId !== attemptB.problemId) {
      throw new InvalidComparisonError({
        reason: "DIFFERENT_PROBLEM",
        attemptAId: input.attemptAId,
        attemptBId: input.attemptBId,
      });
    }

    const [earlierAttempt, laterAttempt] =
      attemptA.attemptNumber <= attemptB.attemptNumber
        ? [attemptA, attemptB]
        : [attemptB, attemptA];

    const problem = await this.deps.problems.findById(earlierAttempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(earlierAttempt.problemId);
    }

    const earlier = await this.loadSide(earlierAttempt);
    const later = await this.loadSide(laterAttempt);
    // Only counted as real prior findings when the earlier attempt actually has a
    // completed evaluation to draw them from; `loadSide` already returns `[]` when
    // it does not, but stating the rule once here documents why both fields below
    // read from the same expression.
    const earlierFeedback = earlier.criteria === null ? [] : earlier.feedback;

    const comparison = buildAttemptComparison({
      requirements: problem.requirements,
      designBefore: earlier.design,
      designAfter: later.design,
      // Only the earlier attempt's findings are checked against the later design —
      // design evolution asks whether attempt 2 addressed what attempt 1 was told,
      // never the reverse.
      previousFeedback: earlierFeedback,
      criteriaBefore: earlier.criteria,
      criteriaAfter: later.criteria,
    });

    return {
      problem: { id: problem.id, slug: problem.slug, title: problem.title },
      earlier: earlier.summary,
      later: later.summary,
      comparison,
      earlierFeedback,
    };
  }

  private async loadOwned(attemptId: string, learnerId: string): Promise<Attempt> {
    const attempt = await this.deps.attempts.findById(attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(attemptId);
    }
    // Not found rather than forbidden: the distinction would itself disclose that
    // the attempt exists, the same rule every other endpoint in this API follows.
    if (attempt.learnerId !== learnerId) {
      throw new AttemptNotFoundError(attemptId);
    }
    return attempt;
  }

  private async loadSide(attempt: Attempt) {
    const submission = await this.deps.submissions.findLatestByAttemptId(
      attempt.id,
    );
    // An attempt with no submission yet contributes an empty design rather than
    // failing the comparison: everything on the other side reads as newly added,
    // which is simply true.
    const design = submission?.payload ?? emptyStructuredDesign();

    const evaluation =
      submission === null
        ? null
        : await this.deps.evaluations.findLatestBySubmissionId(submission.id);
    const hasCompletedEvaluation = evaluation?.status === "COMPLETED";
    const outcome = hasCompletedEvaluation ? evaluation.outcome : null;

    const summary: ComparedAttemptSummary = {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      hasSubmission: submission !== null,
      submissionVersion: submission?.version ?? null,
      evaluationStatus: evaluation?.status ?? null,
      hasCompletedEvaluation,
      createdAt: attempt.createdAt,
      submittedAt: attempt.submittedAt,
    };

    return {
      summary,
      design,
      criteria: outcome?.criterionResults ?? null,
      feedback: outcome?.priorityImprovements ?? [],
    };
  }
}
