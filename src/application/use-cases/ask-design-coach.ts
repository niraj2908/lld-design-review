import type { CoachAnswer } from "@/domain/coach/coach-answer";
import { emptyStructuredDesign } from "@/domain/design/structured-design";
import {
  AttemptNotFoundError,
  CoachExecutionError,
  CoachNotAvailableError,
  CoachQuestionInvalidError,
  ProblemNotFoundError,
} from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { DesignCoach, PreviousAttemptSummary } from "../ports/design-coach";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

/** Bounds on how much of a previous attempt's outcome may reach the coach. */
const MAX_PREVIOUS_ASSESSMENTS = 6;
const MAX_PREVIOUS_IMPROVEMENTS = 4;

/**
 * A question's length bounds, owned here and re-used by the wire schema — the
 * same "one constant, checked at both boundaries" rule `DEFAULT_DESIGN_LIMITS`
 * follows: the API rejects an out-of-range question before it is even parsed
 * into a request, and this use case checks again so a caller that reaches it
 * directly (a test, a future non-HTTP caller) gets the same guarantee.
 */
export const MIN_QUESTION_LENGTH = 3;
export const MAX_QUESTION_LENGTH = 500;

export interface AskDesignCoachInput {
  readonly attemptId: string;
  readonly learnerId: string;
  readonly question: string;
}

export interface AskDesignCoachResult {
  readonly attemptId: string;
  readonly answer: CoachAnswer;
}

export interface AskDesignCoachDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
  /** `undefined` when no language model is configured — there is no deterministic coach to fall back to. */
  readonly coach: DesignCoach | undefined;
}

/**
 * Answers one question about one attempt, grounded in the learner's own
 * design, their own evaluation, and retrieved knowledge.
 *
 * Everything a `DesignCoach` implementation is allowed to reason from is
 * assembled here, from repositories, before the coach itself ever runs — the
 * coach engine never touches a repository, an attempt, or ownership. This use
 * case's job stops at handing over a `CoachContext` and returning what comes
 * back; the grounding of the answer against the design is the coach engine's
 * own responsibility, exactly as evaluation's grounding belongs to the evaluator.
 */
export class AskDesignCoach {
  constructor(private readonly deps: AskDesignCoachDeps) {}

  async execute(input: AskDesignCoachInput): Promise<AskDesignCoachResult> {
    const question = input.question.trim();
    if (question.length < MIN_QUESTION_LENGTH) {
      throw new CoachQuestionInvalidError({
        reason: "A question must not be empty.",
      });
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new CoachQuestionInvalidError({
        reason: `A question must be at most ${MAX_QUESTION_LENGTH} characters.`,
      });
    }

    // Checked before any repository read: an unconfigured coach is a fact about
    // the environment, not about this attempt, and asking is free to reject.
    if (this.deps.coach === undefined) {
      throw new CoachNotAvailableError();
    }

    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }
    // Not found rather than forbidden, the same rule every other endpoint follows.
    if (attempt.learnerId !== input.learnerId) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    const problem = await this.deps.problems.findById(attempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(attempt.problemId);
    }

    const submission = await this.deps.submissions.findLatestByAttemptId(
      attempt.id,
    );
    // `draftDesign` is never cleared by submitting — it simply stops being
    // reachable for further edits once the attempt leaves `IN_PROGRESS` — so it
    // is not a reliable "has this been submitted" signal on its own. The attempt's
    // own status is: still `IN_PROGRESS` means there can be no submission yet, and
    // a question is useful even then — that is exactly when formative feedback
    // matters most — so the draft stands in. Once the status has moved on, the
    // frozen submission is what is actually being asked about, not whatever the
    // draft happened to hold at the moment it was submitted.
    const isDesignSubmitted = attempt.status !== "IN_PROGRESS";
    const design = isDesignSubmitted
      ? (submission?.payload ?? emptyStructuredDesign())
      : (attempt.draftDesign ?? emptyStructuredDesign());

    const evaluationRow =
      submission === null
        ? null
        : await this.deps.evaluations.findLatestBySubmissionId(submission.id);
    const evaluation =
      evaluationRow?.status === "COMPLETED" ? evaluationRow.outcome : null;

    const previousAttempt = await this.loadPreviousAttemptSummary(
      attempt.learnerId,
      attempt.problemId,
      attempt.attemptNumber,
    );

    try {
      const answer = await this.deps.coach.ask({
        problem,
        design,
        isDesignSubmitted,
        evaluation,
        previousAttempt,
        question,
      });
      return { attemptId: attempt.id, answer };
    } catch (cause) {
      // Whatever went wrong inside the coach — the provider was unreachable, or
      // it answered with something that did not pass validation — is the same
      // kind of failure from the caller's point of view: nothing about the
      // attempt changed, and asking again may simply work.
      throw new CoachExecutionError({ attemptId: attempt.id }, cause);
    }
  }

  /**
   * A bounded summary of the immediately preceding attempt on the same problem,
   * or `null` when this is the first attempt or the previous one was never
   * evaluated. Only counts and short titles cross this boundary — never the
   * previous attempt's design — so one question never pays for loading a whole
   * earlier submission it may not even need.
   */
  private async loadPreviousAttemptSummary(
    learnerId: string,
    problemId: string,
    currentAttemptNumber: number,
  ): Promise<PreviousAttemptSummary | null> {
    const siblings = await this.deps.attempts.findManyByLearnerAndProblem(
      learnerId,
      problemId,
    );
    const previous = siblings
      .filter((sibling) => sibling.attemptNumber < currentAttemptNumber)
      .toSorted((left, right) => right.attemptNumber - left.attemptNumber)
      .at(0);
    if (previous === undefined) {
      return null;
    }

    const submission = await this.deps.submissions.findLatestByAttemptId(
      previous.id,
    );
    if (submission === null) {
      return null;
    }
    const evaluation = await this.deps.evaluations.findLatestBySubmissionId(
      submission.id,
    );
    if (evaluation === null || evaluation.status !== "COMPLETED") {
      return null;
    }

    const outcome = evaluation.outcome;
    if (outcome === null) {
      return null;
    }

    return {
      attemptNumber: previous.attemptNumber,
      criterionAssessments: outcome.criterionResults
        .slice(0, MAX_PREVIOUS_ASSESSMENTS)
        .map((result) => ({
          criterion: result.criterion,
          assessment: result.assessment,
        })),
      priorityImprovements: outcome.priorityImprovements
        .slice(0, MAX_PREVIOUS_IMPROVEMENTS)
        .map((item) => item.what),
    };
  }
}
