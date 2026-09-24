import type { FeedbackItem } from "../feedback/feedback-item";
import type { CriterionResult } from "./criterion-result";

export interface EvaluationOutcome {
  readonly criterionResults: readonly CriterionResult[];
  readonly strengths: readonly string[];
  readonly priorityImprovements: readonly FeedbackItem[];
  readonly summary: string;
  readonly confidence?: number;
}

export interface EvaluationFailure {
  readonly code: string;
  readonly message: string;
}
