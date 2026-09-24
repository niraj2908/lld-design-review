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

export function buildEvaluationIdempotencyKey(input: {
  readonly attemptId: string;
  readonly submissionVersion: number;
  readonly evaluatorVersion: string;
}): string {
  return `${input.attemptId}:v${input.submissionVersion}:${input.evaluatorVersion}`;
}
