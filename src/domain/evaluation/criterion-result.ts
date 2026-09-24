import type { EvaluationCriterion } from "../problem/rubric";
import type { Evidence } from "../feedback/evidence";

export const CRITERION_ASSESSMENTS = [
  "STRONG",
  "ADEQUATE",
  "NEEDS_IMPROVEMENT",
  "MISSING",
] as const;

export type CriterionAssessment = (typeof CRITERION_ASSESSMENTS)[number];

export interface CriterionResult {
  readonly criterion: EvaluationCriterion;
  readonly assessment: CriterionAssessment;
  readonly evidence: readonly Evidence[];
  readonly concern?: string;
  readonly suggestion?: string;
  /** Advisory only. It communicates uncertainty; it is not a score. */
  readonly confidence?: number;
}
