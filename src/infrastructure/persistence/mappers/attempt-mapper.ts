import { Attempt } from "@/domain/attempt/attempt";
import { toStructuredDesign } from "./design-mapper";
import type { AttemptRow } from "./rows";

export function toAttempt(row: AttemptRow): Attempt {
  return Attempt.restore({
    id: row.id,
    problemId: row.problemId,
    learnerId: row.learnerId,
    attemptNumber: row.attemptNumber,
    status: row.status,
    draftDesign:
      row.draftDesign === null ? null : toStructuredDesign(row.draftDesign),
    currentSubmissionId: row.currentSubmissionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
  });
}
