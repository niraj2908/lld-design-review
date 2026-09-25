import type { Evidence } from "../feedback/evidence";
import type { KnowledgeCitation } from "../evaluation/knowledge-citation";
import type { ReviewCriterion } from "../evaluation/review-criterion";

/**
 * How confident the coach is that it had enough to actually answer — not a
 * grade on the design, a grade on the *question*.
 *
 * `SUFFICIENT_CONTEXT` is not a claim that the answer is correct, only that the
 * problem, the design and (where available) the evaluation gave the coach
 * something concrete to reason from. `AMBIGUOUS` is the state that matters most
 * to get right: it is what lets the coach ask a focused follow-up instead of
 * inventing an assumption to answer with.
 */
export const COACH_CERTAINTIES = [
  "SUFFICIENT_CONTEXT",
  "LIMITED_CONTEXT",
  "AMBIGUOUS",
] as const;

export type CoachCertainty = (typeof COACH_CERTAINTIES)[number];

/**
 * One thing the coach observed in the learner's own design, with the evidence
 * that supports it. An observation with no evidence is not a fact about the
 * design, so `evidence` is never empty here — a claim that could not be grounded
 * is dropped before it becomes an observation, the same rule the evaluators use.
 */
export interface CoachObservation {
  readonly text: string;
  readonly evidence: readonly Evidence[];
}

/**
 * A suggestion, never an instruction and never applied automatically. The coach
 * can only describe a change in words; the learner is the one who edits the
 * design.
 */
export interface CoachRecommendation {
  readonly suggestion: string;
  readonly rationale: string;
}

/**
 * A grounded answer to one question about one attempt.
 *
 * Three kinds of grounding stay visibly separate, because a learner is entitled
 * to know which is which: `observations[].evidence` points at the learner's own
 * design, `evaluationReferences` points at criteria the stored evaluation
 * actually reported on (never a criterion the coach merely mentions in prose),
 * and `knowledgeCitations` names retrieved guidance the coach read — never
 * evidence of what the learner did, and never a solution to copy.
 */
export interface CoachAnswer {
  readonly answer: string;
  readonly observations: readonly CoachObservation[];
  readonly recommendation?: CoachRecommendation;
  /**
   * Criteria from the attempt's own stored evaluation that the answer draws on.
   * Validated against that evaluation's actual criterion results — a criterion
   * the evaluation never reported on cannot appear here, however confidently the
   * model names one.
   */
  readonly evaluationReferences: readonly ReviewCriterion[];
  readonly knowledgeCitations: readonly KnowledgeCitation[];
  readonly certainty: CoachCertainty;
  /**
   * Present when the coach judged the question unanswerable with confidence
   * from what it was given — asked instead of guessed.
   */
  readonly followUpQuestion?: string;
  /** How many evidence or evaluation references the model offered but could not be verified, and so were dropped. */
  readonly unverifiedReferenceCount: number;
}
