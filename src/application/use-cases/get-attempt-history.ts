import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import { ProblemNotFoundError } from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface GetAttemptHistoryInput {
  readonly learnerId: string;
  readonly problemId: string;
}

export interface AttemptHistoryEntry {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly submissionId: string | null;
  readonly submissionVersion: number | null;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly createdAt: Date;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface GetAttemptHistoryResult {
  readonly problemId: string;
  readonly entries: readonly AttemptHistoryEntry[];
}

export interface GetAttemptHistoryDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
}

export class GetAttemptHistory {
  constructor(private readonly deps: GetAttemptHistoryDeps) {}

  async execute(
    input: GetAttemptHistoryInput,
  ): Promise<GetAttemptHistoryResult> {
    const problem = await this.deps.problems.findById(input.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(input.problemId);
    }

    const attempts = await this.deps.attempts.findManyByLearnerAndProblem(
      input.learnerId,
      problem.id,
    );

    const entries: AttemptHistoryEntry[] = [];
    for (const attempt of attempts.toSorted(
      (left, right) => left.attemptNumber - right.attemptNumber,
    )) {
      const submission = await this.deps.submissions.findLatestByAttemptId(
        attempt.id,
      );
      const evaluation =
        submission === null
          ? null
          : await this.deps.evaluations.findLatestBySubmissionId(submission.id);

      entries.push({
        attemptId: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        submissionId: submission?.id ?? null,
        submissionVersion: submission?.version ?? null,
        evaluationStatus: evaluation?.status ?? null,
        createdAt: attempt.createdAt,
        submittedAt: attempt.submittedAt,
        completedAt: attempt.completedAt,
      });
    }

    return { problemId: problem.id, entries };
  }
}
