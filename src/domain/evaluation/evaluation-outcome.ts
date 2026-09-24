import type { FeedbackItem } from "../feedback/feedback-item";
import type { CriterionResult } from "./criterion-result";
import type { KnowledgeCitation } from "./knowledge-citation";

export interface EvaluationOutcome {
  readonly criterionResults: readonly CriterionResult[];
  readonly strengths: readonly string[];
  readonly priorityImprovements: readonly FeedbackItem[];
  readonly summary: string;
  readonly confidence?: number;
  /**
   * Reference knowledge the judge was given, in retrieval order. Provenance, not
   * evidence: it says what informed the judgement, never what the learner did.
   */
  readonly knowledgeCitations?: readonly KnowledgeCitation[];
}

export interface EvaluationFailure {
  readonly code: string;
  readonly message: string;
}
