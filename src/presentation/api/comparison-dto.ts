import type { ChangeKind } from "@/domain/comparison/change-kind";
import type { CriterionTrend } from "@/domain/comparison/criterion-evolution";
import type { FeedbackResolutionStatus } from "@/domain/comparison/feedback-resolution";
import type { CoverageTransition } from "@/domain/comparison/requirement-coverage-comparison";
import { natureOf } from "@/domain/evaluation/review-criterion";
import type {
  CompareAttemptsResult,
  ComparedAttemptSummary,
} from "@/application/use-cases/compare-attempts";
import type { EvidenceResponse } from "./dto";
import { toEvidence } from "./dto";

/**
 * The wire shape of a design-evolution comparison.
 *
 * Kept in its own file rather than folded into `dto.ts`: a comparison is not one
 * more attempt-shaped resource, it is a whole aggregate of its own, and this file
 * is the seam a future comparison feature (a third attempt, a saved comparison)
 * would extend without touching the attempt DTOs at all.
 */

export interface ChangeCountsResponse {
  readonly added: number;
  readonly removed: number;
  readonly modified: number;
  readonly unchanged: number;
}

export interface NamedChangeResponse {
  readonly kind: ChangeKind;
  readonly name: string;
}

export interface ClassChangeResponse {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly responsibilityChanged: boolean;
  readonly responsibilityBefore?: string;
  readonly responsibilityAfter?: string;
  readonly attributeChanges: readonly NamedChangeResponse[];
  readonly methodChanges: readonly NamedChangeResponse[];
}

export interface InterfaceChangeResponse {
  readonly kind: ChangeKind;
  readonly name: string;
  readonly responsibilityChanged: boolean;
  readonly responsibilityBefore?: string;
  readonly responsibilityAfter?: string;
  readonly methodChanges: readonly NamedChangeResponse[];
}

export interface RelationshipChangeResponse {
  readonly kind: ChangeKind;
  readonly source: string;
  readonly target: string;
  readonly typeChanged: boolean;
  readonly typeBefore?: string;
  readonly typeAfter?: string;
}

export interface DecisionChangeResponse {
  readonly kind: ChangeKind;
  readonly decision: string;
  readonly rationaleBefore?: string;
  readonly rationaleAfter?: string;
  readonly tradeoffBefore?: string;
  readonly tradeoffAfter?: string;
}

export interface EdgeCaseChangeResponse {
  readonly kind: ChangeKind;
  readonly description: string;
  readonly expectedBehaviorBefore?: string;
  readonly expectedBehaviorAfter?: string;
}

export interface RequirementCoverageChangeResponse {
  readonly requirementId: string;
  readonly code: string;
  readonly title: string;
  readonly coveredBefore: boolean;
  readonly coveredAfter: boolean;
  readonly transition: CoverageTransition;
  readonly changed: boolean;
}

export interface FeedbackEvolutionResponse {
  readonly feedbackId: string;
  readonly priority: string;
  readonly criterion?: string;
  readonly what: string;
  readonly why: string;
  readonly where: readonly EvidenceResponse[];
  readonly status: FeedbackResolutionStatus;
  readonly detail: string;
  readonly entitiesStillPresent: readonly string[];
  readonly entitiesRemoved: readonly string[];
}

export interface CriterionEvolutionResponse {
  readonly criterion: string;
  readonly nature: "FACTUAL" | "SEMANTIC";
  readonly trend: CriterionTrend;
  readonly before?: {
    readonly assessment: string;
    readonly concern?: string;
    readonly confidence?: number;
  };
  readonly after?: {
    readonly assessment: string;
    readonly concern?: string;
    readonly suggestion?: string;
    readonly confidence?: number;
  };
}

export interface ComparisonSummaryResponse {
  readonly classes: ChangeCountsResponse;
  readonly interfaces: ChangeCountsResponse;
  readonly relationships: ChangeCountsResponse;
  readonly decisions: ChangeCountsResponse;
  readonly edgeCases: ChangeCountsResponse;
  readonly requirementsNewlyCovered: number;
  readonly requirementsCoverageLost: number;
  readonly feedbackAddressed: number;
  readonly feedbackStillPresent: number;
  readonly feedbackUncertain: number;
  readonly feedbackNotComparable: number;
  readonly criteriaImproved: number;
  readonly criteriaRegressed: number;
  readonly criteriaChanged: number;
  readonly totalStructuralChanges: number;
  readonly mostSignificantFeedbackId?: string;
  readonly mostSignificantRegression?: string;
}

export interface ComparedAttemptResponse {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: string;
  readonly hasSubmission: boolean;
  readonly submissionVersion: number | null;
  readonly evaluationStatus: string | null;
  readonly hasCompletedEvaluation: boolean;
  readonly createdAt: string;
  readonly submittedAt: string | null;
}

export interface AttemptComparisonResponse {
  readonly problem: { readonly id: string; readonly slug: string; readonly title: string };
  readonly earlier: ComparedAttemptResponse;
  readonly later: ComparedAttemptResponse;
  readonly classChanges: readonly ClassChangeResponse[];
  readonly interfaceChanges: readonly InterfaceChangeResponse[];
  readonly relationshipChanges: readonly RelationshipChangeResponse[];
  readonly decisionChanges: readonly DecisionChangeResponse[];
  readonly edgeCaseChanges: readonly EdgeCaseChangeResponse[];
  readonly requirementCoverage: readonly RequirementCoverageChangeResponse[];
  readonly feedbackEvolution: readonly FeedbackEvolutionResponse[];
  readonly criterionEvolutions: readonly CriterionEvolutionResponse[];
  readonly summary: ComparisonSummaryResponse;
}

export function toAttemptComparisonResponse(
  result: CompareAttemptsResult,
): AttemptComparisonResponse {
  const { comparison } = result;

  return {
    problem: result.problem,
    earlier: toComparedAttemptResponse(result.earlier),
    later: toComparedAttemptResponse(result.later),
    classChanges: comparison.structure.classChanges.map((change) => ({
      kind: change.kind,
      name: change.name,
      responsibilityChanged: change.responsibilityChanged,
      ...(change.before === undefined
        ? {}
        : { responsibilityBefore: change.before.responsibility }),
      ...(change.after === undefined
        ? {}
        : { responsibilityAfter: change.after.responsibility }),
      attributeChanges: change.attributeChanges.map(toNamedChange),
      methodChanges: change.methodChanges.map(toNamedChange),
    })),
    interfaceChanges: comparison.structure.interfaceChanges.map((change) => ({
      kind: change.kind,
      name: change.name,
      responsibilityChanged: change.responsibilityChanged,
      ...(change.before === undefined
        ? {}
        : { responsibilityBefore: change.before.responsibility }),
      ...(change.after === undefined
        ? {}
        : { responsibilityAfter: change.after.responsibility }),
      methodChanges: change.methodChanges.map(toNamedChange),
    })),
    relationshipChanges: comparison.structure.relationshipChanges.map((change) => ({
      kind: change.kind,
      source: change.source,
      target: change.target,
      typeChanged: change.typeChanged,
      ...(change.before === undefined ? {} : { typeBefore: change.before.type }),
      ...(change.after === undefined ? {} : { typeAfter: change.after.type }),
    })),
    decisionChanges: comparison.structure.decisionChanges.map((change) => ({
      kind: change.kind,
      decision: change.decision,
      ...(change.before === undefined
        ? {}
        : { rationaleBefore: change.before.rationale, tradeoffBefore: change.before.tradeoff }),
      ...(change.after === undefined
        ? {}
        : { rationaleAfter: change.after.rationale, tradeoffAfter: change.after.tradeoff }),
    })),
    edgeCaseChanges: comparison.structure.edgeCaseChanges.map((change) => ({
      kind: change.kind,
      description: change.description,
      ...(change.before === undefined
        ? {}
        : { expectedBehaviorBefore: change.before.expectedBehavior }),
      ...(change.after === undefined
        ? {}
        : { expectedBehaviorAfter: change.after.expectedBehavior }),
    })),
    requirementCoverage: comparison.requirementCoverage.map((change) => ({
      requirementId: change.requirementId,
      code: change.code,
      title: change.title,
      coveredBefore: change.coveredBefore,
      coveredAfter: change.coveredAfter,
      transition: change.transition,
      changed: change.changed,
    })),
    feedbackEvolution: comparison.feedbackResolutions.map((resolution, index) => {
      const item = result.earlierFeedback[index];
      return {
        feedbackId: resolution.feedbackId,
        priority: item?.priority ?? "P3",
        ...(item?.criterion === undefined ? {} : { criterion: item.criterion }),
        what: item?.what ?? "",
        why: item?.why ?? "",
        where: (item?.where ?? []).map(toEvidence),
        status: resolution.status,
        detail: resolution.detail,
        entitiesStillPresent: resolution.entitiesStillPresent,
        entitiesRemoved: resolution.entitiesRemoved,
      };
    }),
    criterionEvolutions: comparison.criterionEvolutions.map((evolution) => ({
      criterion: evolution.criterion,
      nature: natureOf(evolution.criterion),
      trend: evolution.trend,
      ...(evolution.before === undefined
        ? {}
        : {
            before: {
              assessment: evolution.before.assessment,
              ...(evolution.before.concern === undefined
                ? {}
                : { concern: evolution.before.concern }),
              ...(evolution.before.confidence === undefined
                ? {}
                : { confidence: evolution.before.confidence }),
            },
          }),
      ...(evolution.after === undefined
        ? {}
        : {
            after: {
              assessment: evolution.after.assessment,
              ...(evolution.after.concern === undefined
                ? {}
                : { concern: evolution.after.concern }),
              ...(evolution.after.suggestion === undefined
                ? {}
                : { suggestion: evolution.after.suggestion }),
              ...(evolution.after.confidence === undefined
                ? {}
                : { confidence: evolution.after.confidence }),
            },
          }),
    })),
    summary: {
      classes: comparison.summary.classes,
      interfaces: comparison.summary.interfaces,
      relationships: comparison.summary.relationships,
      decisions: comparison.summary.decisions,
      edgeCases: comparison.summary.edgeCases,
      requirementsNewlyCovered: comparison.summary.requirementsNewlyCovered,
      requirementsCoverageLost: comparison.summary.requirementsCoverageLost,
      feedbackAddressed: comparison.summary.feedbackAddressed,
      feedbackStillPresent: comparison.summary.feedbackStillPresent,
      feedbackUncertain: comparison.summary.feedbackUncertain,
      feedbackNotComparable: comparison.summary.feedbackNotComparable,
      criteriaImproved: comparison.summary.criteriaImproved,
      criteriaRegressed: comparison.summary.criteriaRegressed,
      criteriaChanged: comparison.summary.criteriaChanged,
      totalStructuralChanges: comparison.summary.totalStructuralChanges,
      ...(comparison.summary.mostSignificantFeedbackId === undefined
        ? {}
        : { mostSignificantFeedbackId: comparison.summary.mostSignificantFeedbackId }),
      ...(comparison.summary.mostSignificantRegression === undefined
        ? {}
        : { mostSignificantRegression: comparison.summary.mostSignificantRegression }),
    },
  };
}

function toNamedChange(change: { readonly kind: ChangeKind; readonly name: string }): NamedChangeResponse {
  return { kind: change.kind, name: change.name };
}

function toComparedAttemptResponse(
  summary: ComparedAttemptSummary,
): ComparedAttemptResponse {
  return {
    attemptId: summary.attemptId,
    attemptNumber: summary.attemptNumber,
    status: summary.status,
    hasSubmission: summary.hasSubmission,
    submissionVersion: summary.submissionVersion,
    evaluationStatus: summary.evaluationStatus,
    hasCompletedEvaluation: summary.hasCompletedEvaluation,
    createdAt: summary.createdAt.toISOString(),
    submittedAt: summary.submittedAt?.toISOString() ?? null,
  };
}
