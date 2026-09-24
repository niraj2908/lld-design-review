import { Attempt } from "@/domain/attempt/attempt";
import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import { ProblemNotFoundError } from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { Clock } from "../ports/clock";
import type { IdGenerator } from "../ports/id-generator";
import { ID_PREFIXES } from "../ports/id-generator";
import type { ProblemRepository } from "../ports/problem-repository";

export interface StartAttemptInput {
  readonly problemId: string;
  readonly learnerId: string;
}

export interface StartAttemptResult {
  readonly attemptId: string;
  readonly problemId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
}

export interface StartAttemptDeps {
  readonly problems: ProblemRepository;
  readonly attempts: AttemptRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export class StartAttempt {
  constructor(private readonly deps: StartAttemptDeps) {}

  async execute(input: StartAttemptInput): Promise<StartAttemptResult> {
    const problem = await this.deps.problems.findById(input.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(input.problemId);
    }

    const existing = await this.deps.attempts.countByLearnerAndProblem(
      input.learnerId,
      problem.id,
    );

    const attempt = Attempt.start({
      id: this.deps.ids.generate(ID_PREFIXES.attempt),
      problemId: problem.id,
      learnerId: input.learnerId,
      attemptNumber: existing + 1,
      now: this.deps.clock.now(),
    });

    await this.deps.attempts.save(attempt);

    return {
      attemptId: attempt.id,
      problemId: attempt.problemId,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
    };
  }
}
