import type { StructuredDesign } from "../design/structured-design";
import {
  InvalidAttemptError,
  InvalidAttemptStateError,
} from "../shared/errors";
import { isBlank } from "../shared/text";
import { assertAttemptTransition } from "./attempt-state-machine";
import type { AttemptStatus } from "./attempt-status";

export interface AttemptSnapshot {
  readonly id: string;
  readonly problemId: string;
  readonly learnerId: string;
  readonly attemptNumber: number;
  readonly status: AttemptStatus;
  readonly draftDesign: StructuredDesign | null;
  readonly currentSubmissionId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly submittedAt: Date | null;
  readonly completedAt: Date | null;
}

export class Attempt {
  private constructor(private state: AttemptSnapshot) {}

  static start(input: {
    readonly id: string;
    readonly problemId: string;
    readonly learnerId: string;
    readonly attemptNumber: number;
    readonly now: Date;
  }): Attempt {
    requireAttemptField(input.id, "id");
    requireAttemptField(input.problemId, "problemId");
    requireAttemptField(input.learnerId, "learnerId");

    if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
      throw new InvalidAttemptError(
        `Attempt number must be a positive integer, received ${input.attemptNumber}.`,
        { field: "attemptNumber" },
      );
    }

    return new Attempt({
      id: input.id,
      problemId: input.problemId,
      learnerId: input.learnerId,
      attemptNumber: input.attemptNumber,
      status: "IN_PROGRESS",
      draftDesign: null,
      currentSubmissionId: null,
      createdAt: input.now,
      updatedAt: input.now,
      submittedAt: null,
      completedAt: null,
    });
  }

  static restore(snapshot: AttemptSnapshot): Attempt {
    return new Attempt({ ...snapshot });
  }

  get id(): string {
    return this.state.id;
  }

  get problemId(): string {
    return this.state.problemId;
  }

  get learnerId(): string {
    return this.state.learnerId;
  }

  get attemptNumber(): number {
    return this.state.attemptNumber;
  }

  get status(): AttemptStatus {
    return this.state.status;
  }

  get draftDesign(): StructuredDesign | null {
    return this.state.draftDesign;
  }

  get currentSubmissionId(): string | null {
    return this.state.currentSubmissionId;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  get submittedAt(): Date | null {
    return this.state.submittedAt;
  }

  get completedAt(): Date | null {
    return this.state.completedAt;
  }

  /** Drafts stay mutable; only submitted work is frozen. */
  saveDraft(design: StructuredDesign, now: Date): void {
    this.assertOperationAllowed("saveDraft", "IN_PROGRESS");
    this.state = { ...this.state, draftDesign: design, updatedAt: now };
  }

  markSubmitted(submissionId: string, now: Date): void {
    assertAttemptTransition(this.state.id, this.state.status, "SUBMITTED");
    this.state = {
      ...this.state,
      status: "SUBMITTED",
      currentSubmissionId: submissionId,
      submittedAt: now,
      updatedAt: now,
    };
  }

  markEvaluating(now: Date): void {
    assertAttemptTransition(this.state.id, this.state.status, "EVALUATING");
    this.state = { ...this.state, status: "EVALUATING", updatedAt: now };
  }

  markCompleted(now: Date): void {
    assertAttemptTransition(this.state.id, this.state.status, "COMPLETED");
    this.state = {
      ...this.state,
      status: "COMPLETED",
      completedAt: now,
      updatedAt: now,
    };
  }

  markFailed(now: Date): void {
    assertAttemptTransition(this.state.id, this.state.status, "FAILED");
    this.state = { ...this.state, status: "FAILED", updatedAt: now };
  }

  toSnapshot(): AttemptSnapshot {
    return { ...this.state };
  }

  private assertOperationAllowed(
    operation: string,
    ...allowed: readonly AttemptStatus[]
  ): void {
    if (!allowed.includes(this.state.status)) {
      throw new InvalidAttemptStateError({
        attemptId: this.state.id,
        from: this.state.status,
        operation,
      });
    }
  }
}

function requireAttemptField(value: string, field: string): void {
  if (isBlank(value)) {
    throw new InvalidAttemptError(`Attempt "${field}" must not be empty.`, {
      field,
    });
  }
}
