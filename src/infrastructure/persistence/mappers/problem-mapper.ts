import { Problem } from "@/domain/problem/problem";
import type { Requirement } from "@/domain/problem/requirement";
import { isEvaluationCriterion } from "@/domain/problem/rubric";
import type { Rubric } from "@/domain/problem/rubric";
import { PersistenceMappingError } from "../persistence-errors";
import type { ProblemRow } from "./rows";

export function toProblem(row: ProblemRow): Problem {
  if (row.rubric === null) {
    throw new PersistenceMappingError(
      `Problem "${row.id}" has no stored rubric; evaluation cannot run without one.`,
    );
  }

  const requirements: readonly Requirement[] = row.requirements
    .toSorted((left, right) => left.position - right.position)
    .map((requirement) => ({
      id: requirement.id,
      problemId: requirement.problemId,
      code: requirement.code,
      title: requirement.title,
      description: requirement.description,
      priority: requirement.priority,
    }));

  const rubric: Rubric = {
    version: row.rubric.version,
    criteria: row.rubric.criteria
      .toSorted((left, right) => left.position - right.position)
      .map((criterion) => {
        // The column can hold deterministic criteria too; a rubric asks a judge
        // for an opinion, so only the semantic ones belong in one.
        if (!isEvaluationCriterion(criterion.criterion)) {
          throw new PersistenceMappingError(
            `Problem "${row.id}" has a rubric criterion "${criterion.criterion}", which is a deterministic criterion and cannot be judged against a rubric.`,
          );
        }
        return {
          criterion: criterion.criterion,
          weight: criterion.weight,
          guidance: criterion.guidance,
        };
      }),
  };

  // Problem.create re-checks every domain invariant, so a row that was edited
  // outside the application fails loudly here instead of reaching a use case.
  return Problem.create({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    context: row.context,
    constraints: [...row.constraints],
    requirements,
    acceptedSubmissionFormats: [...row.acceptedSubmissionFormats],
    rubric,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
