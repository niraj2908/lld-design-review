import type { KnowledgeContext } from "./knowledge-context";
import type { CoachAnswer } from "@/domain/coach/coach-answer";
import type { CriterionAssessment } from "@/domain/evaluation/criterion-result";
import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import type { ReviewCriterion } from "@/domain/evaluation/review-criterion";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Problem } from "@/domain/problem/problem";

/**
 * A bounded look at one earlier attempt's outcome — never the earlier attempt's
 * full design. The coach is allowed to know "your previous attempt was told X",
 * not to re-read an entire earlier submission for every question; that would be
 * exactly the "dump every attempt into the prompt" this port exists to avoid.
 * A full structural comparison (milestone 8's `CompareAttempts`) is a heavier,
 * differently-shaped answer to a differently-shaped question — "how did my
 * design evolve" — and is not built here; see the architecture notes for why
 * that stays a deliberate non-goal of this context.
 */
export interface PreviousAttemptSummary {
  readonly attemptNumber: number;
  readonly criterionAssessments: readonly {
    readonly criterion: ReviewCriterion;
    readonly assessment: CriterionAssessment;
  }[];
  /** The `what` of each priority improvement, bounded — not the full finding. */
  readonly priorityImprovements: readonly string[];
}

/**
 * Everything the coach is allowed to see to answer one question about one
 * attempt.
 *
 * Deliberately narrower than a full evaluation context: no reference or model
 * answer, no other learner's work, and no more history than one bounded summary
 * of the immediately preceding attempt. `knowledge` is attached by the concrete
 * `DesignCoach`, after it decides what to retrieve for this question — the same
 * division of labour `EvaluationContext` uses for `AIDesignEvaluator`.
 */
export interface CoachContext {
  readonly problem: Problem;
  readonly design: StructuredDesign;
  /** Whether `design` is the frozen submission or the still-editable draft. */
  readonly isDesignSubmitted: boolean;
  /** This attempt's own most recent completed evaluation, or `null` if none has run. */
  readonly evaluation: EvaluationOutcome | null;
  readonly previousAttempt: PreviousAttemptSummary | null;
  readonly question: string;
  readonly knowledge?: KnowledgeContext;
}

/**
 * Contract only. A real implementation asks a language model; a test can stub
 * one with a fixed answer, the same way `DesignEvaluator` is stubbed.
 */
export interface DesignCoach {
  ask(context: CoachContext): Promise<CoachAnswer>;
}
