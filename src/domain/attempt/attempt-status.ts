export const ATTEMPT_STATUSES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "EVALUATING",
  "COMPLETED",
  "FAILED",
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
