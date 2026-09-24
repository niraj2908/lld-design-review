import type { StructuredDesign } from "@/domain/design/structured-design";
import type { Finding, RuleAnalysis } from "./rule-analysis";

const NO_DECISIONS_SUGGESTION =
  "Record the choices you made, why you made them, and what each one costs.";

/**
 * Reports whether the learner recorded design decisions with a rationale and a
 * trade-off.
 *
 * Whether a decision is a good one is a judgement, and a design with fewer
 * abstractions is not worse for having fewer decisions to explain. Only presence
 * is reported.
 */
export function analyseDesignDecisions(
  design: StructuredDesign,
): RuleAnalysis {
  const recorded = design.decisions;

  if (recorded.length === 0) {
    const finding: Finding = {
      code: "NO_DESIGN_DECISIONS_RECORDED",
      priority: "P2",
      what: "The submission records no design decisions.",
      where: [],
      why: "A reviewer can see what the design is but not why it is that way, so the reasoning cannot be discussed.",
      reconsider: NO_DECISIONS_SUGGESTION,
    };

    return {
      criterion: "DESIGN_DECISIONS",
      assessment: "MISSING",
      evidence: [],
      concern: "No design decisions were recorded.",
      suggestion: NO_DECISIONS_SUGGESTION,
      strengths: [],
      findings: [finding],
    };
  }

  return {
    criterion: "DESIGN_DECISIONS",
    assessment: "ADEQUATE",
    evidence: [],
    strengths: [
      `${recorded.length} design ${recorded.length === 1 ? "decision is" : "decisions are"} recorded with a rationale and a trade-off.`,
    ],
    findings: [],
  };
}
