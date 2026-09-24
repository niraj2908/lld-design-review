import type { ReviewCriterion } from "../evaluation/review-criterion";
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
  readonly criterion?: ReviewCriterion;
  /**
   * Machine-readable reason this item exists, for example
   * `REQUIREMENT_NOT_COVERED`. Deterministic findings always carry one so a
   * benchmark can count them without parsing prose; a judge's item may not.
   */
  readonly code?: string;
  readonly what: string;
  readonly where: readonly Evidence[];
  readonly why: string;
  readonly reconsider?: string;
}

export function isGrounded(item: FeedbackItem): boolean {
  return item.where.length > 0;
}
