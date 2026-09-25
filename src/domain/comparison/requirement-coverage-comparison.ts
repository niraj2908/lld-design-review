import type { Requirement } from "../problem/requirement";
import type { StructuredDesign } from "../design/structured-design";

export const COVERAGE_TRANSITIONS = [
  "UNCOVERED_TO_COVERED",
  "COVERED_TO_UNCOVERED",
  "COVERED_TO_COVERED",
  "UNCOVERED_TO_UNCOVERED",
] as const;

export type CoverageTransition = (typeof COVERAGE_TRANSITIONS)[number];

export interface RequirementCoverageChange {
  readonly requirementId: string;
  readonly code: string;
  readonly title: string;
  readonly coveredBefore: boolean;
  readonly coveredAfter: boolean;
  readonly transition: CoverageTransition;
  /** `true` for the two transitions that actually changed anything. */
  readonly changed: boolean;
}

/**
 * A requirement is covered in a design when it has a mapping with at least one
 * reference — the same rule the learner-facing coverage meter uses.
 *
 * Every requirement is drawn from `requirements`, the current problem's own list,
 * and a design's mappings are only ever consulted for a requirement id that
 * appears in it. A mapping for a requirement id the problem does not have is
 * silently ignored rather than counted, the same guard the learner workspace
 * applies to its own coverage meter: a design carried over, edited, or compared
 * across problems must never let a stale requirement id inflate coverage on
 * either side of the comparison.
 */
export function compareRequirementCoverage(
  requirements: readonly Requirement[],
  before: StructuredDesign,
  after: StructuredDesign,
): readonly RequirementCoverageChange[] {
  const coveredBefore = coveredRequirementIds(requirements, before);
  const coveredAfter = coveredRequirementIds(requirements, after);

  return requirements.map((requirement) => {
    const wasCovered = coveredBefore.has(requirement.id);
    const isCovered = coveredAfter.has(requirement.id);

    return {
      requirementId: requirement.id,
      code: requirement.code,
      title: requirement.title,
      coveredBefore: wasCovered,
      coveredAfter: isCovered,
      transition: transitionOf(wasCovered, isCovered),
      changed: wasCovered !== isCovered,
    };
  });
}

function transitionOf(was: boolean, is: boolean): CoverageTransition {
  if (was && is) return "COVERED_TO_COVERED";
  if (!was && is) return "UNCOVERED_TO_COVERED";
  if (was && !is) return "COVERED_TO_UNCOVERED";
  return "UNCOVERED_TO_UNCOVERED";
}

function coveredRequirementIds(
  requirements: readonly Requirement[],
  design: StructuredDesign,
): ReadonlySet<string> {
  const validIds = new Set(requirements.map((requirement) => requirement.id));
  const covered = new Set<string>();

  for (const mapping of design.requirementMappings) {
    if (validIds.has(mapping.requirementId) && mapping.references.length > 0) {
      covered.add(mapping.requirementId);
    }
  }

  return covered;
}
