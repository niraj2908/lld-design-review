import type { SubmissionRepository } from "@/application/ports/submission-repository";
import type { Submission } from "@/domain/submission/submission";
import { toDesignCreateData } from "../mappers/design-mapper";
import { toSubmission } from "../mappers/submission-mapper";
import {
  withTranslatedCreateErrors,
  withTranslatedErrors,
} from "../persistence-errors";
import type { PrismaClient } from "../prisma/prisma-client";
import { SUBMISSION_INCLUDE } from "./include";

export class PrismaSubmissionRepository implements SubmissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(submissionId: string): Promise<Submission | null> {
    const row = await withTranslatedErrors("submission.findById", () =>
      this.prisma.submission.findUnique({
        where: { id: submissionId },
        include: SUBMISSION_INCLUDE,
      }),
    );
    return row === null ? null : toSubmission(row);
  }

  async findByAttemptId(attemptId: string): Promise<readonly Submission[]> {
    const rows = await withTranslatedErrors("submission.findByAttemptId", () =>
      this.prisma.submission.findMany({
        where: { attemptId },
        include: SUBMISSION_INCLUDE,
        orderBy: { version: "asc" },
      }),
    );
    return rows.map(toSubmission);
  }

  async findLatestByAttemptId(attemptId: string): Promise<Submission | null> {
    const row = await withTranslatedErrors("submission.findLatest", () =>
      this.prisma.submission.findFirst({
        where: { attemptId },
        include: SUBMISSION_INCLUDE,
        orderBy: { version: "desc" },
      }),
    );
    return row === null ? null : toSubmission(row);
  }

  async countByAttemptId(attemptId: string): Promise<number> {
    return withTranslatedErrors("submission.count", () =>
      this.prisma.submission.count({ where: { attemptId } }),
    );
  }

  /**
   * The submission and its frozen design are written by one nested create, so a
   * submission can never exist without the design it recorded. A submitted design
   * is always a fresh row: it is never the attempt's draft row, which stays
   * editable until the attempt leaves IN_PROGRESS.
   */
  async save(submission: Submission): Promise<void> {
    const snapshot = submission.toSnapshot();

    await withTranslatedCreateErrors("submission.save", () =>
      this.prisma.submission.create({
        data: {
          id: snapshot.id,
          attempt: { connect: { id: snapshot.attemptId } },
          version: snapshot.version,
          formatType: snapshot.formatType,
          createdAt: snapshot.createdAt,
          design: { create: toDesignCreateData(snapshot.payload) },
        },
      }),
    );
  }
}
