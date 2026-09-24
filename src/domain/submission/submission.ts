import { isDesignEmpty } from "../design/structured-design";
import type { StructuredDesign } from "../design/structured-design";
import { deepFreeze } from "../shared/deep-freeze";
import { SubmissionValidationError } from "../shared/errors";
import { isBlank } from "../shared/text";
import type { SubmissionFormatType } from "./submission-format-type";

export interface SubmissionSnapshot {
  readonly id: string;
  readonly attemptId: string;
  readonly version: number;
  readonly formatType: SubmissionFormatType;
  readonly payload: StructuredDesign;
  readonly createdAt: Date;
}

/**
 * A submission is the immutable record of what the learner submitted. The
 * payload is deep-frozen because evaluation, retry and attempt comparison all
 * read it afterwards and must see exactly the bytes that were submitted.
 */
export class Submission {
  private constructor(private readonly snapshot: SubmissionSnapshot) {}

  static create(input: {
    readonly id: string;
    readonly attemptId: string;
    readonly version: number;
    readonly formatType: SubmissionFormatType;
    readonly payload: StructuredDesign;
    readonly createdAt: Date;
  }): Submission {
    if (isBlank(input.id)) {
      throw new SubmissionValidationError("A submission needs an id.", {
        reason: "MISSING_ID",
      });
    }
    if (isBlank(input.attemptId)) {
      throw new SubmissionValidationError(
        "A submission must belong to an attempt.",
        { reason: "MISSING_ATTEMPT_ID" },
      );
    }
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new SubmissionValidationError(
        `Submission version must be a positive integer, received ${input.version}.`,
        { reason: "INVALID_VERSION" },
      );
    }
    if (isDesignEmpty(input.payload)) {
      throw new SubmissionValidationError(
        "A submitted design must contain at least one class or interface.",
        { reason: "EMPTY_DESIGN" },
      );
    }

    return new Submission(
      deepFreeze({
        id: input.id,
        attemptId: input.attemptId,
        version: input.version,
        formatType: input.formatType,
        payload: input.payload,
        createdAt: input.createdAt,
      }),
    );
  }

  static restore(snapshot: SubmissionSnapshot): Submission {
    return new Submission(deepFreeze({ ...snapshot }));
  }

  get id(): string {
    return this.snapshot.id;
  }

  get attemptId(): string {
    return this.snapshot.attemptId;
  }

  get version(): number {
    return this.snapshot.version;
  }

  get formatType(): SubmissionFormatType {
    return this.snapshot.formatType;
  }

  get payload(): StructuredDesign {
    return this.snapshot.payload;
  }

  get createdAt(): Date {
    return this.snapshot.createdAt;
  }

  toSnapshot(): SubmissionSnapshot {
    return this.snapshot;
  }
}
