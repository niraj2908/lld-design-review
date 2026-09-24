import type {
  CriterionResult,
  FactualAssessment,
} from "@/domain/evaluation/criterion-result";
import type { DeterministicCriterion } from "@/domain/evaluation/review-criterion";
import type { Evidence } from "@/domain/feedback/evidence";
import type { FeedbackPriority } from "@/domain/feedback/feedback-item";

/**
 * One finding a rule wants the learner to act on, before it is given an id and
 * turned into a `FeedbackItem`.
 */
export interface Finding {
  readonly code: string;
  readonly priority: FeedbackPriority;
  readonly what: string;
  readonly where: readonly Evidence[];
  readonly why: string;
  readonly reconsider?: string;
}

/** What a single rule concludes about its criterion. */
export interface RuleAnalysis {
  readonly criterion: DeterministicCriterion;
  readonly assessment: FactualAssessment;
  readonly evidence: readonly Evidence[];
  readonly concern?: string;
  readonly suggestion?: string;
  /** Verifiably present things worth telling the learner about. */
  readonly strengths: readonly string[];
  readonly findings: readonly Finding[];
}

/**
 * A deterministic result never carries `confidence`: a structural fact is either
 * so or not, and attaching a probability to it would invite the reader to
 * discount something that is checkable.
 */
export function toCriterionResult(analysis: RuleAnalysis): CriterionResult {
  let result: CriterionResult = {
    criterion: analysis.criterion,
    assessment: analysis.assessment,
    evidence: analysis.evidence,
  };
  if (analysis.concern !== undefined) {
    result = { ...result, concern: analysis.concern };
  }
  if (analysis.suggestion !== undefined) {
    result = { ...result, suggestion: analysis.suggestion };
  }
  return result;
}
