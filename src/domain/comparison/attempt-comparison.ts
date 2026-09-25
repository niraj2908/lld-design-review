import type { CriterionResult } from "../evaluation/criterion-result";
import type { FeedbackItem } from "../feedback/feedback-item";
import type { Requirement } from "../problem/requirement";
import type { StructuredDesign } from "../design/structured-design";
import type { ComparisonSummary } from "./comparison-summary";
import { summarizeComparison } from "./comparison-summary";
import type { CriterionEvolution } from "./criterion-evolution";
import { evolveCriteria } from "./criterion-evolution";
import type { DesignStructureComparison } from "./design-comparison";
import { compareDesigns } from "./design-comparison";
import type { FeedbackResolution } from "./feedback-resolution";
import { resolveFeedback } from "./feedback-resolution";
import type { RequirementCoverageChange } from "./requirement-coverage-comparison";
import { compareRequirementCoverage } from "./requirement-coverage-comparison";

export interface AttemptComparisonInput {
  readonly requirements: readonly Requirement[];
  readonly designBefore: StructuredDesign;
  readonly designAfter: StructuredDesign;
  /**
   * The earlier attempt's stored findings, or an empty list when it has no
   * completed evaluation to draw them from. Distinct from `null`: an empty list
   * of findings is a fact ("nothing was raised"), while no evaluation at all is
   * the absence of that fact, which the caller states separately.
   */
  readonly previousFeedback: readonly FeedbackItem[];
  /** `null` when the earlier attempt has no completed evaluation to compare from. */
  readonly criteriaBefore: readonly CriterionResult[] | null;
  /** `null` when the later attempt has no completed evaluation to compare to. */
  readonly criteriaAfter: readonly CriterionResult[] | null;
}

export interface AttemptComparison {
  readonly structure: DesignStructureComparison;
  readonly requirementCoverage: readonly RequirementCoverageChange[];
  readonly feedbackResolutions: readonly FeedbackResolution[];
  readonly criterionEvolutions: readonly CriterionEvolution[];
  readonly summary: ComparisonSummary;
}

/**
 * The single entry point into design comparison: given two already-loaded
 * designs, the requirements they are read against, and whatever evaluation data
 * exists for each, it produces the full structured comparison.
 *
 * Everything this function touches is a plain value already in hand — no
 * repository, no attempt or submission lookup, no ownership check. Those are the
 * application use case's job; this function is pure so every scenario in it can
 * be exercised directly, with fixtures, with nothing to fake and nothing to wait
 * on.
 */
export function buildAttemptComparison(
  input: AttemptComparisonInput,
): AttemptComparison {
  const structure = compareDesigns(input.designBefore, input.designAfter);
  const requirementCoverage = compareRequirementCoverage(
    input.requirements,
    input.designBefore,
    input.designAfter,
  );
  const feedbackResolutions = resolveFeedback(
    input.previousFeedback,
    input.designAfter,
  );
  const criterionEvolutions = evolveCriteria(
    input.criteriaBefore,
    input.criteriaAfter,
  );

  return {
    structure,
    requirementCoverage,
    feedbackResolutions,
    criterionEvolutions,
    summary: summarizeComparison({
      structure,
      requirementCoverage,
      feedbackResolutions,
      criterionEvolutions,
    }),
  };
}
