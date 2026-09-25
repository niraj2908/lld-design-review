import type { ReviewCriterion } from "../evaluation/review-criterion";
import type { ChangeKind } from "./change-kind";
import type { CriterionEvolution } from "./criterion-evolution";
import type { DesignStructureComparison } from "./design-comparison";
import type { FeedbackResolution } from "./feedback-resolution";
import type { RequirementCoverageChange } from "./requirement-coverage-comparison";

export interface ElementChangeCounts {
  readonly added: number;
  readonly removed: number;
  readonly modified: number;
  readonly unchanged: number;
}

export interface ComparisonSummary {
  readonly classes: ElementChangeCounts;
  readonly interfaces: ElementChangeCounts;
  readonly relationships: ElementChangeCounts;
  readonly decisions: ElementChangeCounts;
  readonly edgeCases: ElementChangeCounts;
  readonly requirementsNewlyCovered: number;
  readonly requirementsCoverageLost: number;
  readonly feedbackAddressed: number;
  readonly feedbackStillPresent: number;
  readonly feedbackUncertain: number;
  readonly feedbackNotComparable: number;
  readonly criteriaImproved: number;
  readonly criteriaRegressed: number;
  readonly criteriaChanged: number;
  /** Structural changes across every element kind, excluding `UNCHANGED`. */
  readonly totalStructuralChanges: number;
  /**
   * The single feedback resolution judged most significant, when any qualifies —
   * a reference, not a sentence. Chosen only from `ADDRESSED` resolutions, by how
   * many named entities disappeared; ties keep the earliest in evaluation order,
   * so the pick is stable across runs. `undefined` when nothing qualifies, not
   * guessed at from a weaker signal.
   */
  readonly mostSignificantFeedbackId?: string;
  /**
   * The criterion whose regression is judged most significant, when any
   * qualifies — a reference, not a sentence, chosen by how far the assessment
   * fell and otherwise by evaluation order, for the same reason.
   */
  readonly mostSignificantRegression?: ReviewCriterion;
}

/**
 * Reduces the structural, coverage, feedback and criterion comparisons into
 * counts plus, where a clear deterministic signal exists, a reference to the
 * single most notable feedback resolution and the single most notable
 * regression. It never composes a sentence: the fields it returns point at data
 * the caller already has, and the caller — the DTO mapper or the page — writes
 * the words, the same way the rest of this product's copy is written by
 * presentation code reading domain data, not generated in the domain itself.
 */
export function summarizeComparison(input: {
  readonly structure: DesignStructureComparison;
  readonly requirementCoverage: readonly RequirementCoverageChange[];
  readonly feedbackResolutions: readonly FeedbackResolution[];
  readonly criterionEvolutions: readonly CriterionEvolution[];
}): ComparisonSummary {
  const classes = countBy(input.structure.classChanges);
  const interfaces = countBy(input.structure.interfaceChanges);
  const relationships = countBy(input.structure.relationshipChanges);
  const decisions = countBy(input.structure.decisionChanges);
  const edgeCases = countBy(input.structure.edgeCaseChanges);

  const totalStructuralChanges =
    classes.added +
    classes.removed +
    classes.modified +
    interfaces.added +
    interfaces.removed +
    interfaces.modified +
    relationships.added +
    relationships.removed +
    relationships.modified +
    decisions.added +
    decisions.removed +
    decisions.modified +
    edgeCases.added +
    edgeCases.removed +
    edgeCases.modified;

  return {
    classes,
    interfaces,
    relationships,
    decisions,
    edgeCases,
    requirementsNewlyCovered: input.requirementCoverage.filter(
      (change) => change.transition === "UNCOVERED_TO_COVERED",
    ).length,
    requirementsCoverageLost: input.requirementCoverage.filter(
      (change) => change.transition === "COVERED_TO_UNCOVERED",
    ).length,
    feedbackAddressed: input.feedbackResolutions.filter(
      (resolution) => resolution.status === "ADDRESSED",
    ).length,
    feedbackStillPresent: input.feedbackResolutions.filter(
      (resolution) => resolution.status === "STILL_PRESENT",
    ).length,
    feedbackUncertain: input.feedbackResolutions.filter(
      (resolution) => resolution.status === "UNCERTAIN",
    ).length,
    feedbackNotComparable: input.feedbackResolutions.filter(
      (resolution) => resolution.status === "NOT_COMPARABLE",
    ).length,
    criteriaImproved: input.criterionEvolutions.filter(
      (evolution) => evolution.trend === "IMPROVED",
    ).length,
    criteriaRegressed: input.criterionEvolutions.filter(
      (evolution) => evolution.trend === "REGRESSED",
    ).length,
    criteriaChanged: input.criterionEvolutions.filter(
      (evolution) => evolution.trend === "CHANGED",
    ).length,
    totalStructuralChanges,
    ...mostSignificantFeedback(input.feedbackResolutions),
    ...mostSignificantRegression(input.criterionEvolutions),
  };
}

function countBy(
  changes: readonly { readonly kind: ChangeKind }[],
): ElementChangeCounts {
  return {
    added: changes.filter((change) => change.kind === "ADDED").length,
    removed: changes.filter((change) => change.kind === "REMOVED").length,
    modified: changes.filter((change) => change.kind === "MODIFIED").length,
    unchanged: changes.filter((change) => change.kind === "UNCHANGED").length,
  };
}

function mostSignificantFeedback(
  resolutions: readonly FeedbackResolution[],
): { readonly mostSignificantFeedbackId?: string } {
  let best: FeedbackResolution | undefined;
  for (const resolution of resolutions) {
    if (resolution.status !== "ADDRESSED") {
      continue;
    }
    if (
      best === undefined ||
      resolution.entitiesRemoved.length > best.entitiesRemoved.length
    ) {
      best = resolution;
    }
  }
  return best === undefined ? {} : { mostSignificantFeedbackId: best.feedbackId };
}

/** Worse first, so the deepest fall wins a tie on rank. */
const SEVERITY_RANK: Readonly<Record<string, number>> = {
  MISSING: 0,
  NEEDS_IMPROVEMENT: 1,
  ADEQUATE: 2,
  STRONG: 3,
};

function mostSignificantRegression(
  evolutions: readonly CriterionEvolution[],
): { readonly mostSignificantRegression?: ReviewCriterion } {
  let best: CriterionEvolution | undefined;
  for (const evolution of evolutions) {
    if (evolution.trend !== "REGRESSED" || evolution.after === undefined) {
      continue;
    }
    const bestSeverity =
      best?.after === undefined ? Number.POSITIVE_INFINITY : SEVERITY_RANK[best.after.assessment];
    const candidateSeverity = SEVERITY_RANK[evolution.after.assessment];
    if (best === undefined || (candidateSeverity ?? 0) < (bestSeverity ?? 0)) {
      best = evolution;
    }
  }
  return best === undefined
    ? {}
    : { mostSignificantRegression: best.criterion };
}
