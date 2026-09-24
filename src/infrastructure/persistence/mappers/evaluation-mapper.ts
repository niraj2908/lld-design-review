import type { CriterionResult } from "@/domain/evaluation/criterion-result";
import { Evaluation } from "@/domain/evaluation/evaluation";
import type {
  EvaluationFailure,
  EvaluationOutcome,
} from "@/domain/evaluation/evaluation-outcome";
import type { Evidence } from "@/domain/feedback/evidence";
import type { FeedbackItem } from "@/domain/feedback/feedback-item";
import type { EvaluationCriterion } from "@/domain/problem/rubric";
import { PersistenceMappingError } from "../persistence-errors";
import type {
  EvaluationEvidenceRow,
  EvaluationRow,
} from "./rows";

export interface EvaluationWriteData {
  readonly status: EvaluationRow["status"];
  readonly evaluatorVersion: string;
  readonly rubricVersion: string;
  readonly promptVersion: string;
  readonly knowledgeVersion: string;
  readonly idempotencyKey: string;
  readonly attemptCount: number;
  readonly summary: string | null;
  readonly confidence: number | null;
  readonly strengths: string[];
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface EvaluationChildrenData {
  readonly criterionResults: {
    readonly criterion: CriterionResult["criterion"];
    readonly assessment: CriterionResult["assessment"];
    readonly concern: string | null;
    readonly suggestion: string | null;
    readonly confidence: number | null;
    readonly position: number;
    readonly evidence: { readonly create: EvidenceCreate[] };
  }[];
  readonly feedbackItems: {
    readonly id: string;
    readonly priority: FeedbackItem["priority"];
    readonly criterion: EvaluationCriterion | null;
    readonly what: string;
    readonly why: string;
    readonly reconsider: string | null;
    readonly position: number;
    readonly evidence: { readonly create: EvidenceCreate[] };
  }[];
}

interface EvidenceCreate {
  readonly entity: string;
  readonly field: string | null;
  readonly value: string | null;
  readonly position: number;
}

export function toEvaluationWriteData(
  evaluation: Evaluation,
): EvaluationWriteData {
  const snapshot = evaluation.toSnapshot();
  const outcome = snapshot.outcome;

  return {
    status: snapshot.status,
    evaluatorVersion: snapshot.versions.evaluatorVersion,
    rubricVersion: snapshot.versions.rubricVersion,
    promptVersion: snapshot.versions.promptVersion,
    knowledgeVersion: snapshot.versions.knowledgeVersion,
    idempotencyKey: snapshot.idempotencyKey,
    attemptCount: snapshot.attemptCount,
    summary: outcome?.summary ?? null,
    confidence: outcome?.confidence ?? null,
    strengths: [...(outcome?.strengths ?? [])],
    failureCode: snapshot.failure?.code ?? null,
    failureMessage: snapshot.failure?.message ?? null,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    startedAt: snapshot.startedAt,
    completedAt: snapshot.completedAt,
  };
}

export function toEvaluationChildrenData(
  evaluation: Evaluation,
): EvaluationChildrenData {
  const outcome = evaluation.outcome;
  if (outcome === null) {
    return { criterionResults: [], feedbackItems: [] };
  }

  return {
    criterionResults: outcome.criterionResults.map((result, position) => ({
      criterion: result.criterion,
      assessment: result.assessment,
      concern: result.concern ?? null,
      suggestion: result.suggestion ?? null,
      confidence: result.confidence ?? null,
      position,
      evidence: { create: toEvidenceCreate(result.evidence) },
    })),
    feedbackItems: outcome.priorityImprovements.map((item, position) => ({
      id: item.id,
      priority: item.priority,
      criterion: item.criterion ?? null,
      what: item.what,
      why: item.why,
      reconsider: item.reconsider ?? null,
      position,
      evidence: { create: toEvidenceCreate(item.where) },
    })),
  };
}

function toEvidenceCreate(
  evidence: readonly Evidence[],
): EvidenceCreate[] {
  return evidence.map((entry, position) => ({
    entity: entry.entity,
    field: entry.field ?? null,
    value: entry.value ?? null,
    position,
  }));
}

export function toEvaluation(row: EvaluationRow): Evaluation {
  return Evaluation.restore({
    id: row.id,
    submissionId: row.submissionId,
    status: row.status,
    versions: {
      evaluatorVersion: row.evaluatorVersion,
      rubricVersion: row.rubricVersion,
      promptVersion: row.promptVersion,
      knowledgeVersion: row.knowledgeVersion,
    },
    idempotencyKey: row.idempotencyKey,
    attemptCount: row.attemptCount,
    outcome: toOutcome(row),
    failure: toFailure(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  });
}

/**
 * An outcome exists exactly when the evaluation completed: `Evaluation.complete`
 * is the only way to set one, and it is also the only transition into COMPLETED.
 * A COMPLETED row with no summary means something wrote the table directly.
 */
function toOutcome(row: EvaluationRow): EvaluationOutcome | null {
  if (row.status !== "COMPLETED") {
    return null;
  }
  if (row.summary === null) {
    throw new PersistenceMappingError(
      `Evaluation "${row.id}" is COMPLETED but stores no summary.`,
    );
  }

  const base = {
    criterionResults: row.criterionResults
      .toSorted((left, right) => left.position - right.position)
      .map(toCriterionResult),
    strengths: [...row.strengths],
    priorityImprovements: row.feedbackItems
      .toSorted((left, right) => left.position - right.position)
      .map(toFeedbackItem),
    summary: row.summary,
  };

  return row.confidence === null ? base : { ...base, confidence: row.confidence };
}

function toCriterionResult(
  row: EvaluationRow["criterionResults"][number],
): CriterionResult {
  const base = {
    criterion: row.criterion,
    assessment: row.assessment,
    evidence: toEvidence(row.evidence),
  };
  let result: CriterionResult = base;
  if (row.concern !== null) {
    result = { ...result, concern: row.concern };
  }
  if (row.suggestion !== null) {
    result = { ...result, suggestion: row.suggestion };
  }
  if (row.confidence !== null) {
    result = { ...result, confidence: row.confidence };
  }
  return result;
}

function toFeedbackItem(
  row: EvaluationRow["feedbackItems"][number],
): FeedbackItem {
  let item: FeedbackItem = {
    id: row.id,
    priority: row.priority,
    what: row.what,
    where: toEvidence(row.evidence),
    why: row.why,
  };
  if (row.criterion !== null) {
    item = { ...item, criterion: row.criterion };
  }
  if (row.reconsider !== null) {
    item = { ...item, reconsider: row.reconsider };
  }
  return item;
}

function toEvidence(
  rows: readonly EvaluationEvidenceRow[],
): readonly Evidence[] {
  return rows
    .toSorted((left, right) => left.position - right.position)
    .map((row) => {
      let evidence: Evidence = { entity: row.entity };
      if (row.field !== null) {
        evidence = { ...evidence, field: row.field };
      }
      if (row.value !== null) {
        evidence = { ...evidence, value: row.value };
      }
      return evidence;
    });
}

function toFailure(row: EvaluationRow): EvaluationFailure | null {
  if (row.failureCode === null || row.failureMessage === null) {
    return null;
  }
  return { code: row.failureCode, message: row.failureMessage };
}
