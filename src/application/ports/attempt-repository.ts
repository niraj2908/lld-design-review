import type { Attempt } from "@/domain/attempt/attempt";

export interface AttemptRepository {
  findById(attemptId: string): Promise<Attempt | null>;
  findManyByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<readonly Attempt[]>;
  /** Every attempt a learner has made, newest first. Drives the history screen. */
  findManyByLearner(learnerId: string): Promise<readonly Attempt[]>;
  countByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<number>;
  save(attempt: Attempt): Promise<void>;
  update(attempt: Attempt): Promise<void>;
}
