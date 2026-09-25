import type { CriterionAssessment, CriterionResult } from "../evaluation/criterion-result";
import type { FindingNature, ReviewCriterion } from "../evaluation/review-criterion";
import { natureOf } from "../evaluation/review-criterion";
import { orderedUnion } from "./list-diff";

export const CRITERION_TRENDS = [
  "IMPROVED",
  "REGRESSED",
  "CHANGED",
  "UNCHANGED",
  "NOT_COMPARABLE",
] as const;

export type CriterionTrend = (typeof CRITERION_TRENDS)[number];

export interface CriterionEvolution {
  readonly criterion: ReviewCriterion;
  readonly nature: FindingNature;
  readonly before?: CriterionResult;
  readonly after?: CriterionResult;
  readonly trend: CriterionTrend;
}

/**
 * Best to worst. A rank comparison, never a numerical score: the distance
 * between `STRONG` and `MISSING` is not measured, only its direction.
 */
const ASSESSMENT_RANK: Readonly<Record<CriterionAssessment, number>> = {
  STRONG: 0,
  ADEQUATE: 1,
  NEEDS_IMPROVEMENT: 2,
  MISSING: 3,
};

/**
 * Compares two evaluations criterion by criterion — never as a single score,
 * because "the average went up" can hide a real regression on one criterion
 * behind an improvement on another, and this product's whole premise is that a
 * learner is entitled to see which.
 *
 * A criterion missing from either side is `NOT_COMPARABLE` rather than guessed
 * at as an improvement or a new concern: the two evaluations may simply have run
 * different evaluators (a deterministic-only run has no semantic criteria at
 * all), and treating an evaluator change as if it were a design change would be
 * exactly the kind of false signal this feature exists to avoid. `null` for
 * either side (no completed evaluation to compare) yields no entries at all —
 * that is a coarser fact the caller already knows and states separately.
 */
export function evolveCriteria(
  before: readonly CriterionResult[] | null,
  after: readonly CriterionResult[] | null,
): readonly CriterionEvolution[] {
  if (before === null || after === null) {
    return [];
  }

  const beforeByCriterion = new Map(
    before.map((result) => [result.criterion, result]),
  );
  const afterByCriterion = new Map(
    after.map((result) => [result.criterion, result]),
  );
  const criteria = orderedUnion(
    before.map((result) => result.criterion),
    after.map((result) => result.criterion),
  ) as readonly ReviewCriterion[];

  return criteria.map((criterion): CriterionEvolution => {
    const previous = beforeByCriterion.get(criterion);
    const current = afterByCriterion.get(criterion);
    const nature = natureOf(criterion);

    if (previous === undefined || current === undefined) {
      return {
        criterion,
        nature,
        ...(previous === undefined ? {} : { before: previous }),
        ...(current === undefined ? {} : { after: current }),
        trend: "NOT_COMPARABLE",
      };
    }

    const rankBefore = ASSESSMENT_RANK[previous.assessment];
    const rankAfter = ASSESSMENT_RANK[current.assessment];

    let trend: CriterionTrend;
    if (rankAfter < rankBefore) {
      trend = "IMPROVED";
    } else if (rankAfter > rankBefore) {
      trend = "REGRESSED";
    } else if (
      (previous.concern ?? "").trim() !== (current.concern ?? "").trim()
    ) {
      // Same standing, but the substance of the finding is not the same finding —
      // a different concern at the same severity is still something to read.
      trend = "CHANGED";
    } else {
      trend = "UNCHANGED";
    }

    return { criterion, nature, before: previous, after: current, trend };
  });
}
