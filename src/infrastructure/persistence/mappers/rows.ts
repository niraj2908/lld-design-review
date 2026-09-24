import type { CriterionAssessment } from "@/domain/evaluation/criterion-result";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { FeedbackPriority } from "@/domain/feedback/feedback-item";
import type { EvaluationCriterion } from "@/domain/problem/rubric";
import type { RequirementPriority } from "@/domain/problem/requirement";
import type { RelationshipType } from "@/domain/design/relationship-type";
import type { SubmissionFormatType } from "@/domain/submission/submission-format-type";

/**
 * Row shapes the mappers read.
 *
 * They are declared here rather than imported from the generated Prisma client
 * so that mapping is pure, unit-testable without a database, and so a schema
 * rename shows up as a type error in one file. Prisma's query results satisfy
 * these structurally; the enum columns are generated from the same domain
 * unions, so no string widening is needed.
 */
export interface RequirementRow {
  readonly id: string;
  readonly problemId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly priority: RequirementPriority;
  readonly position: number;
}

export interface RubricCriterionRow {
  readonly criterion: EvaluationCriterion;
  readonly weight: number;
  readonly guidance: string;
  readonly position: number;
}

export interface ProblemRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly constraints: readonly string[];
  readonly acceptedSubmissionFormats: readonly SubmissionFormatType[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly requirements: readonly RequirementRow[];
  readonly rubric: {
    readonly version: string;
    readonly criteria: readonly RubricCriterionRow[];
  } | null;
}

export interface DesignClassRow {
  readonly elementId: string;
  readonly name: string;
  readonly responsibility: string;
  readonly attributes: unknown;
  readonly methods: unknown;
  readonly position: number;
}

export interface DesignInterfaceRow {
  readonly elementId: string;
  readonly name: string;
  readonly responsibility: string;
  readonly methods: unknown;
  readonly position: number;
}

export interface DesignRelationshipRow {
  readonly source: string;
  readonly target: string;
  readonly type: RelationshipType;
  readonly cardinality: string | null;
  readonly rationale: string | null;
  readonly position: number;
}

export interface DesignDecisionRow {
  readonly decision: string;
  readonly rationale: string;
  readonly tradeoff: string;
  readonly position: number;
}

export interface DesignEdgeCaseRow {
  readonly description: string;
  readonly expectedBehavior: string;
  readonly position: number;
}

export interface DesignReferenceRow {
  readonly entity: string;
  readonly field: string | null;
  readonly value: string | null;
  readonly position: number;
}

export interface DesignRequirementMappingRow {
  readonly requirementId: string;
  readonly note: string | null;
  readonly position: number;
  readonly references: readonly DesignReferenceRow[];
}

export interface DesignRow {
  readonly id: string;
  readonly classes: readonly DesignClassRow[];
  readonly interfaces: readonly DesignInterfaceRow[];
  readonly relationships: readonly DesignRelationshipRow[];
  readonly decisions: readonly DesignDecisionRow[];
  readonly edgeCases: readonly DesignEdgeCaseRow[];
  readonly requirementMappings: readonly DesignRequirementMappingRow[];
}

export interface AttemptRow {
  readonly id: string;
  readonly problemId: string;
  readonly learnerId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly currentSubmissionId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
  readonly draftDesign: DesignRow | null;
}

export interface SubmissionRow {
  readonly id: string;
  readonly attemptId: string;
  readonly version: number;
  readonly formatType: SubmissionFormatType;
  readonly createdAt: Date;
  readonly design: DesignRow;
}

export interface EvaluationEvidenceRow {
  readonly entity: string;
  readonly field: string | null;
  readonly value: string | null;
  readonly position: number;
}

export interface EvaluationCriterionResultRow {
  readonly criterion: EvaluationCriterion;
  readonly assessment: CriterionAssessment;
  readonly concern: string | null;
  readonly suggestion: string | null;
  readonly confidence: number | null;
  readonly position: number;
  readonly evidence: readonly EvaluationEvidenceRow[];
}

export interface EvaluationFeedbackItemRow {
  readonly id: string;
  readonly priority: FeedbackPriority;
  readonly criterion: EvaluationCriterion | null;
  readonly what: string;
  readonly why: string;
  readonly reconsider: string | null;
  readonly position: number;
  readonly evidence: readonly EvaluationEvidenceRow[];
}

export interface EvaluationRow {
  readonly id: string;
  readonly submissionId: string;
  readonly status: EvaluationStatus;
  readonly evaluatorVersion: string;
  readonly rubricVersion: string;
  readonly promptVersion: string;
  readonly knowledgeVersion: string;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly summary: string | null;
  readonly confidence: number | null;
  readonly strengths: readonly string[];
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly criterionResults: readonly EvaluationCriterionResultRow[];
  readonly feedbackItems: readonly EvaluationFeedbackItemRow[];
}
