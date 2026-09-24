import type { StructuredDesign } from "../design/structured-design";
import type { ValidationResult } from "../shared/validation";
import type { SubmissionFormatType } from "./submission-format-type";

export interface SubmissionFormatContext {
  readonly requirementIds: readonly string[];
}

/**
 * The seam that keeps diagram and code submissions addable later without the
 * application layer knowing how a design is represented.
 *
 * `normalize` runs before `validate` and must not throw on learner input; it
 * returns the canonical shape, and validation reports what is wrong with it.
 */
export interface SubmissionFormat<TPayload = StructuredDesign> {
  readonly type: SubmissionFormatType;
  normalize(input: unknown): TPayload;
  validate(payload: TPayload, context: SubmissionFormatContext): ValidationResult;
}
