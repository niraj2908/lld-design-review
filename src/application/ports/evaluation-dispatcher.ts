export interface EvaluationRequest {
  readonly attemptId: string;
  readonly submissionId: string;
  readonly submissionVersion: number;
  readonly evaluatorVersion: string;
  readonly idempotencyKey: string;
}

/**
 * Contract only. The first adapter runs in-process; a Kafka adapter can replace
 * it without the application layer changing (ADR-008).
 */
export interface EvaluationDispatcher {
  dispatch(request: EvaluationRequest): Promise<void>;
}
