export const SUBMISSION_FORMAT_TYPES = ["STRUCTURED_DESIGN"] as const;

export type SubmissionFormatType = (typeof SUBMISSION_FORMAT_TYPES)[number];

export const STRUCTURED_DESIGN: SubmissionFormatType = "STRUCTURED_DESIGN";

export function isSubmissionFormatType(
  value: unknown,
): value is SubmissionFormatType {
  return (
    typeof value === "string" &&
    (SUBMISSION_FORMAT_TYPES as readonly string[]).includes(value)
  );
}
