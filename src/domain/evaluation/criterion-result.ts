import type { Evidence } from "../feedback/evidence";
import type { ReviewCriterion } from "./review-criterion";

export const CRITERION_ASSESSMENTS = [
  "STRONG",
  "ADEQUATE",
  "NEEDS_IMPROVEMENT",
  "MISSING",
] as const;

export type CriterionAssessment = (typeof CRITERION_ASSESSMENTS)[number];

/**
 * Assessments a factual result may use. A deterministic evaluator never claims
 * STRONG: "the check passes" is a fact, "this is strong design" is a judgement.
 */
export const FACTUAL_ASSESSMENTS = [
  "ADEQUATE",
  "NEEDS_IMPROVEMENT",
  "MISSING",
] as const;

export type FactualAssessment = (typeof FACTUAL_ASSESSMENTS)[number];

export interface CriterionResult {
  readonly criterion: ReviewCriterion;
  readonly assessment: CriterionAssessment;
  readonly evidence: readonly Evidence[];
  readonly concern?: string;
  readonly suggestion?: string;
  /** Advisory only. It communicates uncertainty; it is not a score. */
  readonly confidence?: number;
}
