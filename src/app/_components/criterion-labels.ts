/**
 * Human-readable names for every criterion a stored evaluation may report on.
 * Shared between the review page and the comparison page, so a criterion reads
 * the same way wherever a learner sees it.
 */
export const READABLE_CRITERION: Readonly<Record<string, string>> = {
  STRUCTURAL_VALIDITY: "Structural validity",
  REQUIREMENT_COVERAGE: "Requirement coverage",
  DESIGN_COMPLETENESS: "Design completeness",
  EDGE_CASE_COVERAGE: "Edge cases recorded",
  DESIGN_DECISIONS: "Decisions recorded",
  RESPONSIBILITY: "Responsibility quality",
  COHESION: "Cohesion",
  COUPLING: "Coupling",
  ENCAPSULATION: "Encapsulation",
  ABSTRACTION: "Abstraction",
  EXTENSIBILITY: "Extensibility",
  DESIGN_REASONING: "Design reasoning",
  EDGE_CASES: "Edge-case reasoning",
  TESTABILITY: "Testability",
  REQUIREMENT_UNDERSTANDING: "Requirement understanding",
};
