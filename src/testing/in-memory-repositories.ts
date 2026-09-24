import type { AttemptRepository } from "@/application/ports/attempt-repository";
import type { EvaluationRepository } from "@/application/ports/evaluation-repository";
import type { ProblemRepository } from "@/application/ports/problem-repository";
import type { SubmissionRepository } from "@/application/ports/submission-repository";
import { Attempt } from "@/domain/attempt/attempt";
import { Evaluation } from "@/domain/evaluation/evaluation";
import type { Problem } from "@/domain/problem/problem";
import { Submission } from "@/domain/submission/submission";

export class InMemoryProblemRepository implements ProblemRepository {
  private readonly problems = new Map<string, Problem>();

  constructor(problems: readonly Problem[] = []) {
    for (const problem of problems) {
      this.problems.set(problem.id, problem);
    }
  }

  async findById(problemId: string): Promise<Problem | null> {
    return this.problems.get(problemId) ?? null;
  }

  async findBySlug(slug: string): Promise<Problem | null> {
    return (
      [...this.problems.values()].find((problem) => problem.slug === slug) ??
      null
    );
  }

  async findAll(): Promise<readonly Problem[]> {
    return [...this.problems.values()];
  }
}

/**
 * Stores snapshots rather than entity instances so a test cannot accidentally
 * observe an in-memory mutation that a real database would never have persisted.
 */
export class InMemoryAttemptRepository implements AttemptRepository {
  private readonly rows = new Map<string, ReturnType<Attempt["toSnapshot"]>>();

  async findById(attemptId: string): Promise<Attempt | null> {
    const row = this.rows.get(attemptId);
    return row === undefined ? null : Attempt.restore(row);
  }

  async findManyByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<readonly Attempt[]> {
    return [...this.rows.values()]
      .filter(
        (row) => row.learnerId === learnerId && row.problemId === problemId,
      )
      .map((row) => Attempt.restore(row));
  }

  async findManyByLearner(learnerId: string): Promise<readonly Attempt[]> {
    return [...this.rows.values()]
      .filter((row) => row.learnerId === learnerId)
      .toSorted(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      )
      .map((row) => Attempt.restore(row));
  }

  async countByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<number> {
    return (await this.findManyByLearnerAndProblem(learnerId, problemId)).length;
  }

  async save(attempt: Attempt): Promise<void> {
    this.rows.set(attempt.id, attempt.toSnapshot());
  }

  async update(attempt: Attempt): Promise<void> {
    this.rows.set(attempt.id, attempt.toSnapshot());
  }
}

export class InMemorySubmissionRepository implements SubmissionRepository {
  private readonly rows = new Map<
    string,
    ReturnType<Submission["toSnapshot"]>
  >();

  async findById(submissionId: string): Promise<Submission | null> {
    const row = this.rows.get(submissionId);
    return row === undefined ? null : Submission.restore(row);
  }

  async findByAttemptId(attemptId: string): Promise<readonly Submission[]> {
    return [...this.rows.values()]
      .filter((row) => row.attemptId === attemptId)
      .toSorted((left, right) => left.version - right.version)
      .map((row) => Submission.restore(row));
  }

  async findLatestByAttemptId(attemptId: string): Promise<Submission | null> {
    const all = await this.findByAttemptId(attemptId);
    return all.at(-1) ?? null;
  }

  async countByAttemptId(attemptId: string): Promise<number> {
    return (await this.findByAttemptId(attemptId)).length;
  }

  async save(submission: Submission): Promise<void> {
    this.rows.set(submission.id, submission.toSnapshot());
  }
}

export class InMemoryEvaluationRepository implements EvaluationRepository {
  private readonly rows = new Map<
    string,
    ReturnType<Evaluation["toSnapshot"]>
  >();

  async findById(evaluationId: string): Promise<Evaluation | null> {
    const row = this.rows.get(evaluationId);
    return row === undefined ? null : Evaluation.restore(row);
  }

  async findLatestBySubmissionId(
    submissionId: string,
  ): Promise<Evaluation | null> {
    const matching = [...this.rows.values()]
      .filter((row) => row.submissionId === submissionId)
      .toSorted(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      );
    const latest = matching.at(-1);
    return latest === undefined ? null : Evaluation.restore(latest);
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Evaluation | null> {
    const row = [...this.rows.values()].find(
      (candidate) => candidate.idempotencyKey === idempotencyKey,
    );
    return row === undefined ? null : Evaluation.restore(row);
  }

  async save(evaluation: Evaluation): Promise<void> {
    this.rows.set(evaluation.id, evaluation.toSnapshot());
  }

  async update(evaluation: Evaluation): Promise<void> {
    this.rows.set(evaluation.id, evaluation.toSnapshot());
  }
}
