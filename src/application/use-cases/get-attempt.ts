import type { AttemptSnapshot } from "@/domain/attempt/attempt";
import type { EvaluationSnapshot } from "@/domain/evaluation/evaluation";
import type { Requirement } from "@/domain/problem/requirement";
import type { SubmissionSnapshot } from "@/domain/submission/submission";
import { AttemptNotFoundError, ProblemNotFoundError } from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { EvaluationRepository } from "../ports/evaluation-repository";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface GetAttemptInput {
  readonly attemptId: string;
}

export interface GetAttemptResult {
  readonly attempt: AttemptSnapshot;
  readonly problem: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly requirements: readonly Requirement[];
  };
  readonly latestSubmission: SubmissionSnapshot | null;
  readonly latestEvaluation: EvaluationSnapshot | null;
}

export interface GetAttemptDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly evaluations: EvaluationRepository;
}

export class GetAttempt {
  constructor(private readonly deps: GetAttemptDeps) {}

  async execute(input: GetAttemptInput): Promise<GetAttemptResult> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    const problem = await this.deps.problems.findById(attempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(attempt.problemId);
    }

    const latestSubmission = await this.deps.submissions.findLatestByAttemptId(
      attempt.id,
    );
    const latestEvaluation =
      latestSubmission === null
        ? null
        : await this.deps.evaluations.findLatestBySubmissionId(
            latestSubmission.id,
          );

    return {
      attempt: attempt.toSnapshot(),
      problem: {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        requirements: problem.requirements,
      },
      latestSubmission: latestSubmission?.toSnapshot() ?? null,
      latestEvaluation: latestEvaluation?.toSnapshot() ?? null,
    };
  }
}
