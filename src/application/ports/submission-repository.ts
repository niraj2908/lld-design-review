import type { Submission } from "@/domain/submission/submission";

export interface SubmissionRepository {
  findById(submissionId: string): Promise<Submission | null>;
  findByAttemptId(attemptId: string): Promise<readonly Submission[]>;
  findLatestByAttemptId(attemptId: string): Promise<Submission | null>;
  countByAttemptId(attemptId: string): Promise<number>;
  save(submission: Submission): Promise<void>;
}
