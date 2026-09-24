import { InvalidAttemptStateError } from "../shared/errors";
import type { AttemptStatus } from "./attempt-status";

/**
 * The single place attempt lifecycle rules live. Nothing outside the domain may
 * move an attempt between states.
 *
 * FAILED -> EVALUATING exists because an evaluation failure is an
 * infrastructure outcome, not a learner outcome: the submission survives and
 * the learner can retry.
 */
export const ALLOWED_ATTEMPT_TRANSITIONS: Readonly<
  Record<AttemptStatus, readonly AttemptStatus[]>
> = {
  IN_PROGRESS: ["SUBMITTED"],
  SUBMITTED: ["EVALUATING"],
  EVALUATING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["EVALUATING"],
};

export function canTransitionAttempt(
  from: AttemptStatus,
  to: AttemptStatus,
): boolean {
  return ALLOWED_ATTEMPT_TRANSITIONS[from].includes(to);
}

export function assertAttemptTransition(
  attemptId: string,
  from: AttemptStatus,
  to: AttemptStatus,
): void {
  if (!canTransitionAttempt(from, to)) {
    throw new InvalidAttemptStateError({
      attemptId,
      from,
      to,
      operation: "transition",
    });
  }
}

export function isAttemptTerminal(status: AttemptStatus): boolean {
  return ALLOWED_ATTEMPT_TRANSITIONS[status].length === 0;
}
