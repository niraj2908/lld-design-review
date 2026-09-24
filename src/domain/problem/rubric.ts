export const EVALUATION_CRITERIA = [
  "REQUIREMENT_UNDERSTANDING",
  "RESPONSIBILITY",
  "ENCAPSULATION",
  "COHESION",
  "COUPLING",
  "ABSTRACTION",
  "EXTENSIBILITY",
  "EDGE_CASES",
  "DESIGN_REASONING",
  "TESTABILITY",
] as const;

export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export interface RubricCriterion {
  readonly criterion: EvaluationCriterion;
  readonly weight: number;
  readonly guidance: string;
}

/**
 * Rubrics are problem-specific: weights differ per problem and criteria may be
 * omitted where they do not apply. A rubric describes what to look at, never a
 * reference answer to match.
 */
export interface Rubric {
  readonly version: string;
  readonly criteria: readonly RubricCriterion[];
}
