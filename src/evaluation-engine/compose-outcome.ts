import type { EvaluationOutcome } from "@/domain/evaluation/evaluation-outcome";
import type { FeedbackItem } from "@/domain/feedback/feedback-item";
import { FEEDBACK_PRIORITIES } from "@/domain/feedback/feedback-item";
import { toCriterionResult } from "./rules/rule-analysis";
import type { RuleAnalysis } from "./rules/rule-analysis";
import type { RequirementCoverage } from "./rules/requirement-coverage";

/**
 * Feedback item ids are derived from the submission, the criterion and the
 * item's position rather than generated, because the evaluator must return the
 * same result for the same submission. A random id would make two runs differ.
 *
 * The submission id must be part of it: `EvaluationFeedbackItem.id` is a single
 * global primary key across every evaluation ever stored, not one scoped to this
 * evaluation, so "fbk_responsibility_1" alone would collide with any other
 * submission whose first RESPONSIBILITY finding lands at the same position.
 */
function feedbackId(submissionId: string, criterion: string, position: number): string {
  return `fbk_${submissionId}_${criterion.toLowerCase()}_${position + 1}`;
}

const PRIORITY_ORDER = new Map(
  FEEDBACK_PRIORITIES.map((priority, index) => [priority, index]),
);

export function composeOutcome(input: {
  readonly analyses: readonly RuleAnalysis[];
  readonly coverage: readonly RequirementCoverage[];
  readonly blockingIssueCount: number;
  readonly submissionId: string;
}): EvaluationOutcome {
  const priorityImprovements: FeedbackItem[] = [];

  for (const analysis of input.analyses) {
    analysis.findings.forEach((finding, position) => {
      let item: FeedbackItem = {
        id: feedbackId(input.submissionId, analysis.criterion, position),
        priority: finding.priority,
        criterion: analysis.criterion,
        code: finding.code,
        what: finding.what,
        where: finding.where,
        why: finding.why,
      };
      if (finding.reconsider !== undefined) {
        item = { ...item, reconsider: finding.reconsider };
      }
      priorityImprovements.push(item);
    });
  }

  // Highest-value first, and stable within a priority so the order is reproducible.
  const ordered = priorityImprovements.toSorted(
    (left, right) =>
      (PRIORITY_ORDER.get(left.priority) ?? 0) -
      (PRIORITY_ORDER.get(right.priority) ?? 0),
  );

  return {
    criterionResults: input.analyses.map(toCriterionResult),
    strengths: input.analyses.flatMap((analysis) => analysis.strengths),
    priorityImprovements: ordered,
    summary: buildSummary(input),
    // No confidence: everything above is checkable, so there is nothing to hedge.
  };
}

function buildSummary(input: {
  readonly coverage: readonly RequirementCoverage[];
  readonly blockingIssueCount: number;
}): string {
  const covered = input.coverage.filter(
    (entry) => entry.state === "COVERED",
  ).length;

  const structural =
    input.blockingIssueCount === 0
      ? "The design is structurally sound."
      : `The design has ${input.blockingIssueCount} blocking structural ${input.blockingIssueCount === 1 ? "issue" : "issues"}.`;

  return [
    structural,
    `${covered} of ${input.coverage.length} requirements carry explicit design evidence.`,
    "This report covers only what can be checked from the submission. It makes no judgement about the quality of the design, and a different decomposition is not a worse one.",
  ].join(" ");
}
