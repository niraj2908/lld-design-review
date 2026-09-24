import type { DesignElementIndex } from "@/domain/design/design-element-index";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { DeterministicCriterion } from "@/domain/evaluation/review-criterion";
import type { FeedbackPriority } from "@/domain/feedback/feedback-item";
import type { ValidationIssue } from "@/domain/shared/validation";
import { ISSUE_CRITERIA } from "./issue-criteria";
import { evidenceForIssue } from "./issue-evidence";
import type { Finding, RuleAnalysis } from "./rule-analysis";

/**
 * Turns the structural validator's findings for one criterion into an analysis.
 *
 * No design rule is decided here. `validateStructuredDesign` already ran; this
 * reports its issues under the criterion they belong to, with evidence resolved
 * back to the submitted design.
 */
export function analyseIssues(input: {
  readonly criterion: DeterministicCriterion;
  readonly issues: readonly ValidationIssue[];
  readonly design: StructuredDesign;
  readonly elements: DesignElementIndex;
  readonly passedStrength: string;
  readonly suggestion: string;
}): RuleAnalysis {
  const mine = input.issues.filter(
    (issue) => ISSUE_CRITERIA[issue.code] === input.criterion,
  );

  if (mine.length === 0) {
    return {
      criterion: input.criterion,
      assessment: "ADEQUATE",
      evidence: [],
      strengths: [input.passedStrength],
      findings: [],
    };
  }

  const findings = mine.map<Finding>((issue) => {
    const where = evidenceForIssue(issue, input.design, input.elements);
    return {
      code: issue.code,
      priority: priorityOf(issue),
      what: `${issue.message} (${issue.path})`,
      where,
      why:
        issue.severity === "ERROR"
          ? "A design that does not hold together cannot be reviewed on its merits, and a reader cannot tell what was intended."
          : "It does not block review, but it makes the design harder to read than it needs to be.",
      reconsider: input.suggestion,
    };
  });

  const blocking = mine.filter((issue) => issue.severity === "ERROR").length;

  return {
    criterion: input.criterion,
    assessment: blocking > 0 ? "NEEDS_IMPROVEMENT" : "ADEQUATE",
    evidence: findings.flatMap((finding) => finding.where),
    concern: `${mine.length} structural ${mine.length === 1 ? "issue" : "issues"} found, ${blocking} blocking.`,
    suggestion: input.suggestion,
    strengths: [],
    findings,
  };
}

function priorityOf(issue: ValidationIssue): FeedbackPriority {
  return issue.severity === "ERROR" ? "P1" : "P2";
}
