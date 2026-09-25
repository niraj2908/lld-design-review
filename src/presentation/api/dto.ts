import type { AttemptSnapshot } from "@/domain/attempt/attempt";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { StructuredDesign } from "@/domain/design/structured-design";
import type { EvaluationSnapshot } from "@/domain/evaluation/evaluation";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import { natureOf } from "@/domain/evaluation/review-criterion";
import type { SubmissionSnapshot } from "@/domain/submission/submission";
import type { ProblemDetail } from "@/application/use-cases/get-problem";
import type { AttemptListEntry } from "@/application/use-cases/list-attempts";
import type { ProblemSummary } from "@/application/use-cases/list-problems";
import type { ValidationIssue } from "@/domain/shared/validation";

/**
 * The public shape of the API.
 *
 * Declared here rather than derived from domain snapshots so the wire contract can
 * stay still while the domain moves, and so nothing a client sees is a database
 * column by another name. Dates are ISO strings, because JSON has no dates.
 */
export interface ProblemListItemResponse {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly requirementCount: number;
  readonly mustRequirementCount: number;
}

export interface RequirementResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
}

export interface ProblemResponse extends ProblemListItemResponse {
  readonly constraints: readonly string[];
  readonly requirements: readonly RequirementResponse[];
  readonly acceptedSubmissionFormats: readonly string[];
}

export interface AttemptResponse {
  readonly id: string;
  readonly problemId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly currentSubmissionId: string | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly completedAt: string | null;
}

export interface AttemptWorkspaceResponse {
  readonly attempt: AttemptResponse;
  readonly problem: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly requirements: readonly RequirementResponse[];
  };
  /** The stored draft, or the submitted design once the attempt has been submitted. */
  readonly design: StructuredDesign | null;
  readonly submission: SubmissionResponse | null;
  readonly evaluationStatus: EvaluationStatus | null;
}

export interface AttemptListItemResponse {
  readonly id: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly problemId: string;
  readonly problemSlug: string;
  readonly problemTitle: string;
  readonly submissionVersion: number | null;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly createdAt: string;
  readonly submittedAt: string | null;
  readonly completedAt: string | null;
}

export interface DraftResponse {
  readonly attemptId: string;
  readonly design: StructuredDesign;
  /**
   * Advisory. A draft is allowed to be incomplete; these are what would block a
   * submission today.
   */
  readonly issues: readonly { readonly code: string; readonly path: string; readonly message: string; readonly severity: string }[];
}

export interface SubmissionResponse {
  readonly id: string;
  readonly attemptId: string;
  readonly version: number;
  readonly formatType: string;
  readonly createdAt: string;
}

export interface EvidenceResponse {
  readonly entity: string;
  readonly field?: string;
  readonly value?: string;
}

export interface CriterionResultResponse {
  readonly criterion: string;
  /** FACTUAL for a structural check, SEMANTIC for a judgement. */
  readonly nature: "FACTUAL" | "SEMANTIC";
  readonly assessment: string;
  readonly evidence: readonly EvidenceResponse[];
  readonly concern?: string;
  readonly suggestion?: string;
  readonly confidence?: number;
  readonly unverifiedEvidenceCount?: number;
}

export interface FeedbackItemResponse {
  readonly id: string;
  readonly priority: string;
  readonly criterion?: string;
  readonly nature: "FACTUAL" | "SEMANTIC" | "UNKNOWN";
  readonly code?: string;
  readonly what: string;
  readonly where: readonly EvidenceResponse[];
  readonly why: string;
  readonly reconsider?: string;
}

/** Provenance, deliberately without the passage text: a learner sees what grounded the review, not the prompt. */
export interface KnowledgeCitationResponse {
  readonly ref: string;
  readonly title: string;
  readonly source: string;
  readonly topic: string;
}

export interface EvaluationResponse {
  readonly id: string;
  readonly submissionId: string;
  readonly status: EvaluationStatus;
  readonly attemptCount: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly versions: {
    readonly evaluator: string;
    readonly prompt: string;
    readonly rubric: string;
    readonly knowledge: string;
    readonly provider?: string;
    readonly model?: string;
  };
  readonly outcome: {
    readonly summary: string;
    readonly strengths: readonly string[];
    readonly criterionResults: readonly CriterionResultResponse[];
    readonly priorityImprovements: readonly FeedbackItemResponse[];
    readonly knowledgeCitations: readonly KnowledgeCitationResponse[];
  } | null;
}

export function toProblemListItem(
  problem: ProblemSummary,
): ProblemListItemResponse {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    description: problem.description,
    context: problem.context,
    requirementCount: problem.requirementCount,
    mustRequirementCount: problem.mustRequirementCount,
  };
}

export function toProblemResponse(problem: ProblemDetail): ProblemResponse {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    description: problem.description,
    context: problem.context,
    constraints: problem.constraints,
    requirementCount: problem.requirements.length,
    mustRequirementCount: problem.requirements.filter(
      (requirement) => requirement.priority === "MUST",
    ).length,
    requirements: problem.requirements.map((requirement) => ({
      id: requirement.id,
      code: requirement.code,
      title: requirement.title,
      description: requirement.description,
      priority: requirement.priority,
    })),
    acceptedSubmissionFormats: [...problem.acceptedSubmissionFormats],
  };
}

export function toAttemptResponse(attempt: AttemptSnapshot): AttemptResponse {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    currentSubmissionId: attempt.currentSubmissionId,
    createdAt: attempt.createdAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    completedAt: attempt.completedAt?.toISOString() ?? null,
  };
}

export function toAttemptListItem(
  entry: AttemptListEntry,
): AttemptListItemResponse {
  return {
    id: entry.attemptId,
    attemptNumber: entry.attemptNumber,
    status: entry.status,
    problemId: entry.problemId,
    problemSlug: entry.problemSlug,
    problemTitle: entry.problemTitle,
    submissionVersion: entry.submissionVersion,
    evaluationStatus: entry.evaluationStatus,
    createdAt: entry.createdAt.toISOString(),
    submittedAt: entry.submittedAt?.toISOString() ?? null,
    completedAt: entry.completedAt?.toISOString() ?? null,
  };
}

export function toSubmissionResponse(
  submission: SubmissionSnapshot,
): SubmissionResponse {
  return {
    id: submission.id,
    attemptId: submission.attemptId,
    version: submission.version,
    formatType: submission.formatType,
    createdAt: submission.createdAt.toISOString(),
  };
}

export function toIssueResponse(issue: ValidationIssue): {
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly severity: string;
} {
  return {
    code: issue.code,
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
  };
}

export function toEvaluationResponse(
  evaluation: EvaluationSnapshot,
): EvaluationResponse {
  const outcome = evaluation.outcome;

  return {
    id: evaluation.id,
    submissionId: evaluation.submissionId,
    status: evaluation.status,
    attemptCount: evaluation.attemptCount,
    startedAt: evaluation.startedAt?.toISOString() ?? null,
    completedAt: evaluation.completedAt?.toISOString() ?? null,
    failure: evaluation.failure,
    versions: {
      evaluator: evaluation.versions.evaluatorVersion,
      prompt: evaluation.versions.promptVersion,
      rubric: evaluation.versions.rubricVersion,
      knowledge: evaluation.versions.knowledgeVersion,
      ...(evaluation.versions.provider === undefined
        ? {}
        : { provider: evaluation.versions.provider }),
      ...(evaluation.versions.model === undefined
        ? {}
        : { model: evaluation.versions.model }),
    },
    outcome:
      outcome === null
        ? null
        : {
            summary: outcome.summary,
            strengths: [...outcome.strengths],
            criterionResults: outcome.criterionResults.map((result) => ({
              criterion: result.criterion,
              nature: natureOf(result.criterion),
              assessment: result.assessment,
              evidence: result.evidence.map(toEvidence),
              ...(result.concern === undefined ? {} : { concern: result.concern }),
              ...(result.suggestion === undefined
                ? {}
                : { suggestion: result.suggestion }),
              ...(result.confidence === undefined
                ? {}
                : { confidence: result.confidence }),
              ...(result.unverifiedEvidenceCount === undefined
                ? {}
                : { unverifiedEvidenceCount: result.unverifiedEvidenceCount }),
            })),
            priorityImprovements: outcome.priorityImprovements.map((item) => ({
              id: item.id,
              priority: item.priority,
              nature:
                item.criterion === undefined
                  ? ("UNKNOWN" as const)
                  : natureOf(item.criterion),
              ...(item.criterion === undefined
                ? {}
                : { criterion: item.criterion }),
              ...(item.code === undefined ? {} : { code: item.code }),
              what: item.what,
              where: item.where.map(toEvidence),
              why: item.why,
              ...(item.reconsider === undefined
                ? {}
                : { reconsider: item.reconsider }),
            })),
            // The passage text and the score stay server-side: a learner is shown
            // what grounded the review, not the material the prompt carried.
            knowledgeCitations: (outcome.knowledgeCitations ?? []).map(
              (citation) => ({
                ref: citation.ref,
                title: citation.title,
                source: citation.source,
                topic: citation.topic,
              }),
            ),
          },
  };
}

export function toEvidence(evidence: EvidenceResponse): EvidenceResponse {
  return {
    entity: evidence.entity,
    ...(evidence.field === undefined ? {} : { field: evidence.field }),
    ...(evidence.value === undefined ? {} : { value: evidence.value }),
  };
}
