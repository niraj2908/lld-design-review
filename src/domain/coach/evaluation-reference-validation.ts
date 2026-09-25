import type { ReviewCriterion } from "../evaluation/review-criterion";

/**
 * Keeps only the criteria that actually appear in `known` — the current
 * attempt's own stored evaluation, when one exists.
 *
 * The coach may say a finding relates to `COUPLING`, but that claim is only as
 * good as whether the evaluation it is drawing on actually reported on
 * `COUPLING`. A model can name any string that looks like a criterion; this is
 * the check that stops an evaluation reference from being trusted just because
 * it was spelled correctly, the same discipline `validateEvidence` applies to a
 * quoted design fact.
 */
export function filterKnownCriteria(
  claimed: readonly string[],
  known: readonly ReviewCriterion[],
): readonly ReviewCriterion[] {
  const knownSet = new Set<string>(known);
  const seen = new Set<string>();
  const verified: ReviewCriterion[] = [];

  for (const criterion of claimed) {
    if (knownSet.has(criterion) && !seen.has(criterion)) {
      seen.add(criterion);
      verified.push(criterion as ReviewCriterion);
    }
  }

  return verified;
}
