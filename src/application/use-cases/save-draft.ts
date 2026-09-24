import type { StructuredDesign } from "@/domain/design/structured-design";
import type { ValidationIssue } from "@/domain/shared/validation";
import { structuredDesignFormat } from "@/domain/submission/structured-design-format";
import { AttemptNotFoundError, ProblemNotFoundError } from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { Clock } from "../ports/clock";
import type { ProblemRepository } from "../ports/problem-repository";

export interface SaveDraftInput {
  readonly attemptId: string;
  readonly design: unknown;
}

export interface SaveDraftResult {
  readonly attemptId: string;
  readonly design: StructuredDesign;
  /**
   * Advisory. A draft is allowed to be incomplete, so issues are reported back
   * rather than rejected; submission is where they block.
   */
  readonly issues: readonly ValidationIssue[];
}

export interface SaveDraftDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly clock: Clock;
}

export class SaveDraft {
  constructor(private readonly deps: SaveDraftDeps) {}

  async execute(input: SaveDraftInput): Promise<SaveDraftResult> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    const problem = await this.deps.problems.findById(attempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(attempt.problemId);
    }

    const design = structuredDesignFormat.normalize(input.design);
    const validation = structuredDesignFormat.validate(design, {
      requirementIds: problem.requirementIds,
    });

    attempt.saveDraft(design, this.deps.clock.now());
    await this.deps.attempts.update(attempt);

    return { attemptId: attempt.id, design, issues: validation.issues };
  }
}
