import type { ValidationIssue } from "./validation";

export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidProblemError extends DomainError {
  readonly code = "PROBLEM_INVALID";

  constructor(
    message: string,
    readonly detail: { readonly field: string },
  ) {
    super(message);
  }
}

export class DuplicateEntityError extends DomainError {
  readonly code = "DUPLICATE_ENTITY";

  constructor(
    readonly detail: {
      readonly entity: string;
      readonly field: string;
      readonly value: string;
    },
  ) {
    super(
      `Duplicate ${detail.entity}: ${detail.field} "${detail.value}" is used more than once.`,
    );
  }
}

export class InvalidRelationshipError extends DomainError {
  readonly code = "RELATIONSHIP_INVALID";

  constructor(
    message: string,
    readonly detail: { readonly path: string; readonly value: unknown },
  ) {
    super(message);
  }
}

export class InvalidDesignError extends DomainError {
  readonly code = "DESIGN_INVALID";

  constructor(readonly issues: readonly ValidationIssue[]) {
    super(
      `The design has ${issues.length} blocking validation issue(s): ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }
}

export class SubmissionValidationError extends DomainError {
  readonly code = "SUBMISSION_INVALID";

  constructor(
    message: string,
    readonly detail: { readonly reason: string },
  ) {
    super(message);
  }
}

export class InvalidAttemptError extends DomainError {
  readonly code = "ATTEMPT_INVALID";

  constructor(
    message: string,
    readonly detail: { readonly field: string },
  ) {
    super(message);
  }
}

export class InvalidAttemptStateError extends DomainError {
  readonly code = "ATTEMPT_INVALID_STATE";

  constructor(
    readonly detail: {
      readonly attemptId: string;
      readonly from: string;
      readonly to?: string;
      readonly operation: string;
    },
  ) {
    super(
      detail.to === undefined
        ? `Operation "${detail.operation}" is not allowed while attempt ${detail.attemptId} is ${detail.from}.`
        : `Attempt ${detail.attemptId} cannot move from ${detail.from} to ${detail.to}.`,
    );
  }
}

export class InvalidEvaluationStateError extends DomainError {
  readonly code = "EVALUATION_INVALID_STATE";

  constructor(
    readonly detail: {
      readonly evaluationId: string;
      readonly from: string;
      readonly to: string;
    },
  ) {
    super(
      `Evaluation ${detail.evaluationId} cannot move from ${detail.from} to ${detail.to}.`,
    );
  }
}
