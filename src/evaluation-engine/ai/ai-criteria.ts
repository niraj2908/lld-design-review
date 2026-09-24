import type { EvaluationCriterion } from "@/domain/problem/rubric";

/**
 * The semantic criteria a judge is asked about.
 *
 * They are existing `EvaluationCriterion` values, not a parallel taxonomy, so an
 * AI result and a problem rubric speak the same language and persist in the same
 * column. Two of them are named differently in prose than in the enum:
 * responsibility quality is `RESPONSIBILITY`, and edge-case reasoning is
 * `EDGE_CASES`.
 *
 * `REQUIREMENT_UNDERSTANDING` is deliberately excluded: requirement coverage is
 * settled deterministically from the mappings, and asking a judge to re-decide it
 * invites it to contradict a fact.
 */
export const AI_CRITERIA = [
  "RESPONSIBILITY",
  "COHESION",
  "COUPLING",
  "ENCAPSULATION",
  "ABSTRACTION",
  "EXTENSIBILITY",
  "DESIGN_REASONING",
  "EDGE_CASES",
  "TESTABILITY",
] as const satisfies readonly EvaluationCriterion[];

export type AICriterion = (typeof AI_CRITERIA)[number];

export function isAICriterion(value: EvaluationCriterion): value is AICriterion {
  return (AI_CRITERIA as readonly EvaluationCriterion[]).includes(value);
}

/** What each criterion asks, in the words the judge is given. */
export const AI_CRITERION_QUESTIONS: Readonly<Record<AICriterion, string>> = {
  RESPONSIBILITY:
    "Given the responsibilities each element states, is each one scoped to something that element can own, and is any element carrying work that plainly belongs elsewhere?",
  COHESION:
    "Do the members of each element belong together, or does an element read as two unrelated jobs sharing a name?",
  COUPLING:
    "Do the declared relationships create dependencies the requirements justify, or do they force unrelated parts to change together?",
  ENCAPSULATION:
    "Can the design's invariants be broken by a caller, judging by the attributes and methods exposed?",
  ABSTRACTION:
    "Is each abstraction earning its place against a variation point the problem actually states? Report both a missing one and an unnecessary one.",
  EXTENSIBILITY:
    "For the changes the problem says are likely, how much of this design would have to change?",
  DESIGN_REASONING:
    "Do the recorded decisions explain why, with a trade-off the learner has actually accepted, rather than restating what was built?",
  EDGE_CASES:
    "Do the recorded edge cases address situations this problem really has, and does the design say what happens in them?",
  TESTABILITY:
    "Could the important behaviour be tested without standing up the whole system, judging by the dependencies declared?",
};
