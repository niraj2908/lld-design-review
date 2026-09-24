import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import type { EvaluationStatus } from "@/domain/evaluation/evaluation-status";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface ListAttemptsInput {
  readonly learnerId: string;
}

export interface AttemptListEntry {
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly problemId: string;
  readonly problemSlug: string;
  readonly problemTitle: string;
  readonly submissionId: string | null;
  readonly submissionVersion: number | null;
  readonly evaluationStatus: EvaluationStatus | null;
  readonly createdAt: Date;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
}

export interface ListAttemptsResult {
  readonly attempts: readonly AttemptListEntry[];
}

export interface ListAttemptsDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
}

/**
 * Every attempt a learner has made, across all problems, newest first.
 *
 * Distinct from `GetAttemptHistory`, which answers "how has this learner's design
 * for *this problem* changed" and is the basis of the comparison feature. This one
 * answers "what have I been working on".
 */
export class ListAttempts {
  constructor(private readonly deps: ListAttemptsDeps) {}

  async execute(input: ListAttemptsInput): Promise<ListAttemptsResult> {
    const attempts = await this.deps.attempts.findManyByLearner(input.learnerId);

    // One problem lookup per distinct problem rather than per attempt.
    const problems = new Map(
      (await this.deps.problems.findAll()).map((problem) => [
        problem.id,
        problem,
      ]),
    );

    const entries: AttemptListEntry[] = [];
    for (const attempt of attempts) {
      const problem = problems.get(attempt.problemId);
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
        problemId: attempt.problemId,
        problemSlug: problem?.slug ?? "",
        problemTitle: problem?.title ?? "Unknown problem",
        submissionId: submission?.id ?? null,
        submissionVersion: submission?.version ?? null,
        evaluationStatus: evaluation?.status ?? null,
        createdAt: attempt.createdAt,
        submittedAt: attempt.submittedAt,
        completedAt: attempt.completedAt,
      });
    }

    return { attempts: entries };
  }
}
