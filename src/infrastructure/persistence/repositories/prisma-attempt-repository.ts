import type { AttemptRepository } from "@/application/ports/attempt-repository";
import type { Attempt } from "@/domain/attempt/attempt";
import { toAttempt } from "../mappers/attempt-mapper";
import { toDesignCreateData } from "../mappers/design-mapper";
import {
  withTranslatedCreateErrors,
  withTranslatedErrors,
} from "../persistence-errors";
import type { PrismaClient } from "../prisma/prisma-client";
import { ATTEMPT_INCLUDE } from "./include";

export class PrismaAttemptRepository implements AttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(attemptId: string): Promise<Attempt | null> {
    const row = await withTranslatedErrors("attempt.findById", () =>
      this.prisma.attempt.findUnique({
        where: { id: attemptId },
        include: ATTEMPT_INCLUDE,
      }),
    );
    return row === null ? null : toAttempt(row);
  }

  async findManyByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<readonly Attempt[]> {
    const rows = await withTranslatedErrors("attempt.findMany", () =>
      this.prisma.attempt.findMany({
        where: { learnerId, problemId },
        include: ATTEMPT_INCLUDE,
        orderBy: { attemptNumber: "asc" },
      }),
    );
    return rows.map(toAttempt);
  }

  async countByLearnerAndProblem(
    learnerId: string,
    problemId: string,
  ): Promise<number> {
    return withTranslatedErrors("attempt.count", () =>
      this.prisma.attempt.count({ where: { learnerId, problemId } }),
    );
  }

  async save(attempt: Attempt): Promise<void> {
    const snapshot = attempt.toSnapshot();
    const draft = snapshot.draftDesign;

    await withTranslatedCreateErrors("attempt.save", () =>
      this.prisma.attempt.create({
        data: {
          id: snapshot.id,
          problem: { connect: { id: snapshot.problemId } },
          learner: { connect: { id: snapshot.learnerId } },
          attemptNumber: snapshot.attemptNumber,
          status: snapshot.status,
          currentSubmissionId: snapshot.currentSubmissionId,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
          submittedAt: snapshot.submittedAt,
          completedAt: snapshot.completedAt,
          ...(draft === null
            ? {}
            : { draftDesign: { create: toDesignCreateData(draft) } }),
        },
      }),
    );
  }

  /**
   * The draft design is rewritten only while the attempt is IN_PROGRESS, which is
   * the only state in which a draft can legally change. Every other update is a
   * lifecycle transition, and rewriting the whole design tree for those would
   * churn rows and lose the stored draft for no reason.
   *
   * Repointing the attempt and dropping the previous design must happen together,
   * so this runs in a transaction.
   */
  async update(attempt: Attempt): Promise<void> {
    const snapshot = attempt.toSnapshot();
    const draft = snapshot.draftDesign;

    await withTranslatedErrors("attempt.update", () =>
      this.prisma.$transaction(async (tx) => {
        const current = await tx.attempt.findUnique({
          where: { id: snapshot.id },
          select: { draftDesignId: true },
        });

        const replaceDraft = snapshot.status === "IN_PROGRESS";
        const previousDesignId = current?.draftDesignId ?? null;

        // Wrapped separately from the enclosing update: inside this transaction a
        // missing record means a design element referenced a requirement that
        // does not exist, not that the attempt being updated disappeared.
        const nextDesignId =
          replaceDraft && draft !== null
            ? (
                await withTranslatedCreateErrors(
                  "attempt.update:draftDesign",
                  () =>
                    tx.design.create({
                      data: toDesignCreateData(draft),
                      select: { id: true },
                    }),
                )
              ).id
            : null;

        await tx.attempt.update({
          where: { id: snapshot.id },
          data: {
            status: snapshot.status,
            currentSubmissionId: snapshot.currentSubmissionId,
            updatedAt: snapshot.updatedAt,
            submittedAt: snapshot.submittedAt,
            completedAt: snapshot.completedAt,
            ...(replaceDraft ? { draftDesignId: nextDesignId } : {}),
          },
        });

        if (replaceDraft && previousDesignId !== null) {
          await tx.design.delete({ where: { id: previousDesignId } });
        }
      }),
    );
  }
}
