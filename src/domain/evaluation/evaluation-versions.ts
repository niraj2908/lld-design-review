/**
 * Every evaluation records what produced it, so a result can be reproduced or
 * explained after prompts, rubrics or the knowledge base move on.
 */
export interface EvaluationVersions {
  readonly evaluatorVersion: string;
  readonly rubricVersion: string;
  readonly promptVersion: string;
  readonly knowledgeVersion: string;
}

/**
 * Recorded where a version has no meaning for the evaluator that ran. A
 * deterministic evaluator uses no prompt and no knowledge base, and saying so is
 * clearer than storing an empty string that reads like a missing value.
 */
export const NOT_APPLICABLE_VERSION = "not-applicable";

export function buildEvaluationIdempotencyKey(input: {
  readonly attemptId: string;
  readonly submissionVersion: number;
  readonly evaluatorVersion: string;
}): string {
  return `${input.attemptId}:v${input.submissionVersion}:${input.evaluatorVersion}`;
}
