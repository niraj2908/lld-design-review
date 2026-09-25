import type { AskDesignCoachResult } from "@/application/use-cases/ask-design-coach";
import type { CoachAnswer, CoachCertainty } from "@/domain/coach/coach-answer";
import { natureOf } from "@/domain/evaluation/review-criterion";
import type { EvidenceResponse, KnowledgeCitationResponse } from "./dto";
import { toEvidence } from "./dto";

/**
 * The wire shape of a coach answer. Kept beside `comparison-dto.ts` rather than
 * folded into `dto.ts`, for the same reason: a coach answer is its own
 * aggregate, not an attempt-shaped resource with a field added on.
 */
export interface CoachObservationResponse {
  readonly text: string;
  readonly evidence: readonly EvidenceResponse[];
}

export interface CoachRecommendationResponse {
  readonly suggestion: string;
  readonly rationale: string;
}

export interface CoachEvaluationReferenceResponse {
  readonly criterion: string;
  readonly nature: "FACTUAL" | "SEMANTIC";
}

export interface CoachAnswerResponse {
  readonly attemptId: string;
  readonly answer: string;
  readonly observations: readonly CoachObservationResponse[];
  readonly recommendation?: CoachRecommendationResponse;
  readonly evaluationReferences: readonly CoachEvaluationReferenceResponse[];
  readonly knowledgeCitations: readonly KnowledgeCitationResponse[];
  readonly certainty: CoachCertainty;
  readonly followUpQuestion?: string;
  readonly unverifiedReferenceCount: number;
}

export function toCoachAnswerResponse(
  result: AskDesignCoachResult,
): CoachAnswerResponse {
  const { answer } = result;

  return {
    attemptId: result.attemptId,
    answer: answer.answer,
    observations: answer.observations.map(toCoachObservation),
    ...(answer.recommendation === undefined
      ? {}
      : { recommendation: answer.recommendation }),
    evaluationReferences: answer.evaluationReferences.map((criterion) => ({
      criterion,
      nature: natureOf(criterion),
    })),
    // The passage text stays server-side, the same rule the evaluation response
    // follows: a learner sees what grounded the answer, not the material itself.
    knowledgeCitations: answer.knowledgeCitations.map((citation) => ({
      ref: citation.ref,
      title: citation.title,
      source: citation.source,
      topic: citation.topic,
    })),
    certainty: answer.certainty,
    ...(answer.followUpQuestion === undefined
      ? {}
      : { followUpQuestion: answer.followUpQuestion }),
    unverifiedReferenceCount: answer.unverifiedReferenceCount,
  };
}

function toCoachObservation(
  observation: CoachAnswer["observations"][number],
): CoachObservationResponse {
  return {
    text: observation.text,
    evidence: observation.evidence.map(toEvidence),
  };
}
