export const REQUIREMENT_PRIORITIES = ["MUST", "SHOULD", "COULD"] as const;

export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

export interface Requirement {
  readonly id: string;
  readonly problemId: string;
  /** Learner-facing stable code, for example `PL-REQ-01`. */
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly priority: RequirementPriority;
}
