import { Submission } from "@/domain/submission/submission";
import { toStructuredDesign } from "./design-mapper";
import type { SubmissionRow } from "./rows";

export function toSubmission(row: SubmissionRow): Submission {
  return Submission.restore({
    id: row.id,
    attemptId: row.attemptId,
    version: row.version,
    formatType: row.formatType,
    payload: toStructuredDesign(row.design),
    createdAt: row.createdAt,
  });
}
