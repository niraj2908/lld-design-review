import type { Evaluation } from "@/domain/evaluation/evaluation";

export interface EvaluationRepository {
  findById(evaluationId: string): Promise<Evaluation | null>;
  findLatestBySubmissionId(submissionId: string): Promise<Evaluation | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Evaluation | null>;
  save(evaluation: Evaluation): Promise<void>;
  update(evaluation: Evaluation): Promise<void>;
}
