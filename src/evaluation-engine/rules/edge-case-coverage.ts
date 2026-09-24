import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Finding, RuleAnalysis } from "./rule-analysis";

const NO_EDGE_CASES_SUGGESTION =
  "Write down the situations you expect to go wrong and what should happen in each.";

/**
 * Reports whether the learner recorded edge cases at all.
 *
 * It does not check whether they are the right edge cases, or whether the design
 * actually handles them: both need reading the intent behind the words. The
 * problem statement also carries no machine-readable edge-case list, so there is
 * nothing to match against even if matching were deterministic.
 */
export function analyseEdgeCaseCoverage(
  design: StructuredDesign,
): RuleAnalysis {
  const recorded = design.edgeCases;

  if (recorded.length === 0) {
    const finding: Finding = {
      code: "NO_EDGE_CASES_RECORDED",
      priority: "P2",
      what: "The submission records no edge cases.",
      where: [],
      why: "Edge cases are where a design usually breaks, and none were written down, so there is nothing to review on this point.",
      reconsider: NO_EDGE_CASES_SUGGESTION,
    };

    return {
      criterion: "EDGE_CASE_COVERAGE",
      assessment: "MISSING",
      evidence: [],
      concern: "No edge cases were recorded.",
      suggestion: NO_EDGE_CASES_SUGGESTION,
      strengths: [],
      findings: [finding],
    };
  }

  return {
    criterion: "EDGE_CASE_COVERAGE",
    // Presence is the fact. Whether these are the right edge cases is a judgement.
    assessment: "ADEQUATE",
    evidence: [],
    strengths: [
      `${recorded.length} edge ${recorded.length === 1 ? "case is" : "cases are"} recorded with the behaviour expected in each.`,
    ],
    findings: [],
  };
}
