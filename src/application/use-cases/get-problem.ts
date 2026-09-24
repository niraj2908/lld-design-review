import type { Problem } from "@/domain/problem/problem";
import type { Requirement } from "@/domain/problem/requirement";
import type { SubmissionFormatType } from "@/domain/submission/submission-format-type";
import { ProblemNotFoundError } from "../errors";
import type { ProblemRepository } from "../ports/problem-repository";

export interface GetProblemInput {
  /** Accepts either the stored id or the learner-facing slug. */
  readonly problemRef: string;
}

export interface ProblemDetail {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly constraints: readonly string[];
  readonly requirements: readonly Requirement[];
  readonly acceptedSubmissionFormats: readonly SubmissionFormatType[];
  readonly version: number;
}

/**
 * One problem, as much of it as the learner is meant to see.
 *
 * The rubric is deliberately not part of this: its criteria and weights are how the
 * evaluator reads a design, and publishing them would invite designs written to the
 * scoring rather than to the requirements.
 */
export class GetProblem {
  constructor(private readonly problems: ProblemRepository) {}

  async execute(input: GetProblemInput): Promise<ProblemDetail> {
    const problem =
      (await this.problems.findById(input.problemRef)) ??
      (await this.problems.findBySlug(input.problemRef));

    if (problem === null) {
      throw new ProblemNotFoundError(input.problemRef);
    }

    return toDetail(problem);
  }
}

function toDetail(problem: Problem): ProblemDetail {
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    description: problem.description,
    context: problem.context,
    constraints: [...problem.constraints],
    requirements: problem.requirements,
    acceptedSubmissionFormats: [...problem.acceptedSubmissionFormats],
    version: problem.version,
  };
}
