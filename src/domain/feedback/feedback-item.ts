import type { EvaluationCriterion } from "../problem/rubric";
import type { Evidence } from "./evidence";

export const FEEDBACK_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

/**
 * The shape answers the four questions the product promises for every
 * improvement: what, where, why, and what could be reconsidered.
 */
export interface FeedbackItem {
  readonly id: string;
  readonly priority: FeedbackPriority;
  readonly criterion?: EvaluationCriterion;
  readonly what: string;
  readonly where: readonly Evidence[];
  readonly why: string;
  readonly reconsider?: string;
}

export function isGrounded(item: FeedbackItem): boolean {
  return item.where.length > 0;
}
