export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
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
