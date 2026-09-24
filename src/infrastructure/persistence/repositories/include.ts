/**
 * Shared `include` trees.
 *
 * Every read loads a whole aggregate in one query so that rebuilding an entity
 * never issues a query per child — the N+1 shape the application layer has no
 * way to see or avoid.
 */
export const DESIGN_INCLUDE = {
  classes: true,
  interfaces: true,
  relationships: true,
  decisions: true,
  edgeCases: true,
  requirementMappings: { include: { references: true } },
} as const;

export const PROBLEM_INCLUDE = {
  requirements: true,
  rubric: { include: { criteria: true } },
} as const;

export const ATTEMPT_INCLUDE = {
  draftDesign: { include: DESIGN_INCLUDE },
} as const;

export const SUBMISSION_INCLUDE = {
  design: { include: DESIGN_INCLUDE },
} as const;

export const EVALUATION_INCLUDE = {
  criterionResults: { include: { evidence: true } },
  feedbackItems: { include: { evidence: true } },
  knowledgeCitations: true,
} as const;
