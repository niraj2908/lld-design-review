import type { SubmissionFormat } from "@/domain/submission/submission-format";
import type { SubmissionFormatType } from "@/domain/submission/submission-format-type";

export interface SubmissionFormatRegistry {
  get(type: SubmissionFormatType): SubmissionFormat | undefined;
}
