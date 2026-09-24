import { InvalidEvaluationStateError } from "../shared/errors";

export const EVALUATION_STATUSES = [
  "PENDING",
  "EVALUATING",
  "COMPLETED",
  "FAILED",
] as const;

export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export const ALLOWED_EVALUATION_TRANSITIONS: Readonly<
  Record<EvaluationStatus, readonly EvaluationStatus[]>
> = {
  PENDING: ["EVALUATING"],
  EVALUATING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["EVALUATING"],
};

export function canTransitionEvaluation(
  from: EvaluationStatus,
  to: EvaluationStatus,
): boolean {
  return ALLOWED_EVALUATION_TRANSITIONS[from].includes(to);
}

export function assertEvaluationTransition(
  evaluationId: string,
  from: EvaluationStatus,
  to: EvaluationStatus,
): void {
  if (!canTransitionEvaluation(from, to)) {
    throw new InvalidEvaluationStateError({ evaluationId, from, to });
  }
}
