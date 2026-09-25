export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ProblemNotFoundError extends ApplicationError {
  readonly code = "PROBLEM_NOT_FOUND";

  constructor(readonly problemRef: string) {
    super(`Problem "${problemRef}" was not found.`);
  }
}

export class AttemptNotFoundError extends ApplicationError {
  readonly code = "ATTEMPT_NOT_FOUND";

  constructor(readonly attemptId: string) {
    super(`Attempt "${attemptId}" was not found.`);
  }
}

export class SubmissionNotFoundError extends ApplicationError {
  readonly code = "SUBMISSION_NOT_FOUND";

  constructor(readonly ref: string) {
    super(`No submission was found for "${ref}".`);
  }
}

export class EvaluationNotFoundError extends ApplicationError {
  readonly code = "EVALUATION_NOT_FOUND";

  constructor(readonly ref: string) {
    super(`No evaluation was found for "${ref}".`);
  }
}

export class UnsupportedSubmissionFormatError extends ApplicationError {
  readonly code = "SUBMISSION_FORMAT_UNSUPPORTED";

  constructor(
    readonly detail: {
      readonly formatType: string;
      readonly accepted: readonly string[];
    },
  ) {
    super(
      `Submission format "${detail.formatType}" is not accepted here. Accepted: ${detail.accepted.join(", ")}.`,
    );
  }
}

export class InvalidComparisonError extends ApplicationError {
  readonly code = "COMPARISON_INVALID";

  constructor(
    readonly detail: {
      readonly reason: "SAME_ATTEMPT" | "DIFFERENT_PROBLEM";
      readonly attemptAId: string;
      readonly attemptBId: string;
    },
  ) {
    super(
      detail.reason === "SAME_ATTEMPT"
        ? "An attempt cannot be compared with itself."
        : "Only two attempts on the same problem can be compared with each other.",
    );
  }
}

export class EvaluationExecutionError extends ApplicationError {
  readonly code = "EVALUATION_EXECUTION_FAILED";

  constructor(
    readonly detail: {
      readonly attemptId: string;
      readonly submissionId: string;
      readonly evaluationId: string;
      readonly evaluatorVersion: string;
    },
    cause: unknown,
  ) {
    super(
      `Evaluation ${detail.evaluationId} of submission ${detail.submissionId} failed. The submission is unchanged and the evaluation can be retried.`,
      { cause },
    );
  }
}
