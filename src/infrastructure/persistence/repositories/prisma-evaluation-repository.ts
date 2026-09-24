import type { EvaluationRepository } from "@/application/ports/evaluation-repository";
import type { Evaluation } from "@/domain/evaluation/evaluation";
import {
  toEvaluation,
  toEvaluationChildrenData,
  toEvaluationWriteData,
} from "../mappers/evaluation-mapper";
import {
  withTranslatedCreateErrors,
  withTranslatedErrors,
} from "../persistence-errors";
import type { PrismaClient } from "../prisma/prisma-client";
import { EVALUATION_INCLUDE } from "./include";

export class PrismaEvaluationRepository implements EvaluationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(evaluationId: string): Promise<Evaluation | null> {
    const row = await withTranslatedErrors("evaluation.findById", () =>
      this.prisma.evaluation.findUnique({
        where: { id: evaluationId },
        include: EVALUATION_INCLUDE,
      }),
    );
    return row === null ? null : toEvaluation(row);
  }

  async findLatestBySubmissionId(
    submissionId: string,
  ): Promise<Evaluation | null> {
    const row = await withTranslatedErrors("evaluation.findLatest", () =>
      this.prisma.evaluation.findFirst({
        where: { submissionId },
        include: EVALUATION_INCLUDE,
        orderBy: { createdAt: "desc" },
      }),
    );
    return row === null ? null : toEvaluation(row);
  }

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Evaluation | null> {
    const row = await withTranslatedErrors("evaluation.findByIdempotencyKey", () =>
      this.prisma.evaluation.findUnique({
        where: { idempotencyKey },
        include: EVALUATION_INCLUDE,
      }),
    );
    return row === null ? null : toEvaluation(row);
  }

  async save(evaluation: Evaluation): Promise<void> {
    const children = toEvaluationChildrenData(evaluation);

    await withTranslatedCreateErrors("evaluation.save", () =>
      this.prisma.evaluation.create({
        data: {
          id: evaluation.id,
          submission: { connect: { id: evaluation.submissionId } },
          ...toEvaluationWriteData(evaluation),
          criterionResults: { create: children.criterionResults },
          feedbackItems: { create: children.feedbackItems },
          knowledgeCitations: { create: children.knowledgeCitations },
        },
      }),
    );
  }

  /**
   * An outcome is written whole: a retry discards the previous run's criterion
   * results and feedback rather than merging them, so the rows always describe
   * one run. Clearing and rewriting must be atomic, hence the transaction.
   */
  async update(evaluation: Evaluation): Promise<void> {
    const children = toEvaluationChildrenData(evaluation);

    await withTranslatedErrors("evaluation.update", () =>
      this.prisma.$transaction(async (tx) => {
        await tx.evaluationCriterionResult.deleteMany({
          where: { evaluationId: evaluation.id },
        });
        await tx.evaluationFeedbackItem.deleteMany({
          where: { evaluationId: evaluation.id },
        });
        // Provenance is replaced with the rest of the outcome, so a retry cannot
        // leave the citations of a previous run beside those of this one.
        await tx.evaluationKnowledgeCitation.deleteMany({
          where: { evaluationId: evaluation.id },
        });
        await tx.evaluation.update({
          where: { id: evaluation.id },
          data: {
            ...toEvaluationWriteData(evaluation),
            criterionResults: { create: children.criterionResults },
            feedbackItems: { create: children.feedbackItems },
            knowledgeCitations: { create: children.knowledgeCitations },
          },
        });
      }),
    );
  }
}
