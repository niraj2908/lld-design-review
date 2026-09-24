import type { Requirement } from "@/domain/problem/requirement";
import type { ProblemRepository } from "../ports/problem-repository";

export interface ProblemSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly context: string;
  readonly constraints: readonly string[];
  readonly requirementCount: number;
  readonly mustRequirementCount: number;
}

export interface ListProblemsResult {
  readonly problems: readonly ProblemSummary[];
}

/**
 * The problem library.
 *
 * It exists so the presentation layer has a use case to call instead of a
 * repository: a screen that reaches for `ProblemRepository` directly is one that
 * can grow business rules where nothing tests them.
 */
export class ListProblems {
  constructor(private readonly problems: ProblemRepository) {}

  async execute(): Promise<ListProblemsResult> {
    const problems = await this.problems.findAll();

    return {
      problems: problems.map((problem) => ({
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        description: problem.description,
        context: problem.context,
        constraints: [...problem.constraints],
        requirementCount: problem.requirements.length,
        mustRequirementCount: countMust(problem.requirements),
      })),
    };
  }
}

function countMust(requirements: readonly Requirement[]): number {
  return requirements.filter((requirement) => requirement.priority === "MUST")
    .length;
}
