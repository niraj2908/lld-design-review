import type { EvaluationCriterion } from "../problem/rubric";

/**
 * Criteria a deterministic evaluator can settle from the submission and the
 * problem alone, with no semantic reasoning.
 *
 * They are kept as a separate set from the rubric's `EvaluationCriterion`
 * because the two answer different kinds of question. "Do all relationship
 * endpoints exist?" has one correct answer that a reader can check. "Is this
 * abstraction justified?" does not.
 */
export const DETERMINISTIC_CRITERIA = [
  "STRUCTURAL_VALIDITY",
  "REQUIREMENT_COVERAGE",
  "DESIGN_COMPLETENESS",
  "EDGE_CASE_COVERAGE",
  "DESIGN_DECISIONS",
] as const;

export type DeterministicCriterion = (typeof DETERMINISTIC_CRITERIA)[number];

/** Every criterion a stored evaluation may report on, from either kind of evaluator. */
export type ReviewCriterion = DeterministicCriterion | EvaluationCriterion;

export const FINDING_NATURES = ["FACTUAL", "SEMANTIC"] as const;

/**
 * Whether a result states a checkable fact about the submission or a judgement
 * about its quality. The learner is entitled to know which one they are reading,
 * and a later benchmark can only measure a judge against the judgements.
 */
export type FindingNature = (typeof FINDING_NATURES)[number];

export function isDeterministicCriterion(
  value: unknown,
): value is DeterministicCriterion {
  return (
    typeof value === "string" &&
    (DETERMINISTIC_CRITERIA as readonly string[]).includes(value)
  );
}

/**
 * Derived rather than stored: the two criterion sets are disjoint, so a column
 * could only ever repeat what the criterion already says — or contradict it.
 */
export function natureOf(criterion: ReviewCriterion): FindingNature {
  return isDeterministicCriterion(criterion) ? "FACTUAL" : "SEMANTIC";
}
