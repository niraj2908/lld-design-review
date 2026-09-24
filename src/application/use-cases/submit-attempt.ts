import type { AttemptStatus } from "@/domain/attempt/attempt-status";
import {
  InvalidAttemptStateError,
  InvalidDesignError,
  SubmissionValidationError,
} from "@/domain/shared/errors";
import { blockingIssues } from "@/domain/shared/validation";
import { Submission } from "@/domain/submission/submission";
import { structuredDesignFormat } from "@/domain/submission/structured-design-format";
import type { SubmissionFormatType } from "@/domain/submission/submission-format-type";
import { STRUCTURED_DESIGN } from "@/domain/submission/submission-format-type";
import {
  AttemptNotFoundError,
  ProblemNotFoundError,
  UnsupportedSubmissionFormatError,
} from "../errors";
import type { AttemptRepository } from "../ports/attempt-repository";
import type { Clock } from "../ports/clock";
import type { IdGenerator } from "../ports/id-generator";
import { ID_PREFIXES } from "../ports/id-generator";
import type { ProblemRepository } from "../ports/problem-repository";
import type { SubmissionRepository } from "../ports/submission-repository";

export interface SubmitAttemptInput {
  readonly attemptId: string;
  /** Omit to submit the stored draft. */
  readonly design?: unknown;
  readonly formatType?: SubmissionFormatType;
}

export interface SubmitAttemptResult {
  readonly attemptId: string;
  readonly submissionId: string;
  readonly submissionVersion: number;
  readonly status: AttemptStatus;
}

export interface SubmitAttemptDeps {
  readonly attempts: AttemptRepository;
  readonly problems: ProblemRepository;
  readonly submissions: SubmissionRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export class SubmitAttempt {
  constructor(private readonly deps: SubmitAttemptDeps) {}

  async execute(input: SubmitAttemptInput): Promise<SubmitAttemptResult> {
    const attempt = await this.deps.attempts.findById(input.attemptId);
    if (attempt === null) {
      throw new AttemptNotFoundError(input.attemptId);
    }

    if (attempt.status !== "IN_PROGRESS") {
      throw new InvalidAttemptStateError({
        attemptId: attempt.id,
        from: attempt.status,
        to: "SUBMITTED",
        operation: "submit",
      });
    }

    const problem = await this.deps.problems.findById(attempt.problemId);
    if (problem === null) {
      throw new ProblemNotFoundError(attempt.problemId);
    }

    const formatType = input.formatType ?? STRUCTURED_DESIGN;
    if (!problem.accepts(formatType)) {
      throw new UnsupportedSubmissionFormatError({
        formatType,
        accepted: problem.acceptedSubmissionFormats,
      });
    }

    const rawDesign = input.design ?? attempt.draftDesign;
    if (rawDesign === null || rawDesign === undefined) {
      throw new SubmissionValidationError(
        "There is nothing to submit: no design was supplied and the attempt has no draft.",
        { reason: "NO_DESIGN" },
      );
    }

    const design = structuredDesignFormat.normalize(rawDesign);
    const validation = structuredDesignFormat.validate(design, {
      requirementIds: problem.requirementIds,
    });
    const blocking = blockingIssues(validation);
    if (blocking.length > 0) {
      throw new InvalidDesignError(blocking);
    }

    const now = this.deps.clock.now();
    const version =
      (await this.deps.submissions.countByAttemptId(attempt.id)) + 1;

    const submission = Submission.create({
      id: this.deps.ids.generate(ID_PREFIXES.submission),
      attemptId: attempt.id,
      version,
      formatType,
      payload: design,
      createdAt: now,
    });

    // Persist the learner's work before anything that can fail for external
    // reasons. Evaluation dispatch is deliberately not part of this milestone.
    await this.deps.submissions.save(submission);

    attempt.markSubmitted(submission.id, now);
    await this.deps.attempts.update(attempt);

    return {
      attemptId: attempt.id,
      submissionId: submission.id,
      submissionVersion: submission.version,
      status: attempt.status,
    };
  }
}
