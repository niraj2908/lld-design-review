import { afterAll, describe, expect, it } from "vitest";
import { Attempt } from "@/domain/attempt/attempt";
import { Evaluation } from "@/domain/evaluation/evaluation";
import { Submission } from "@/domain/submission/submission";
import { STRUCTURED_DESIGN } from "@/domain/submission/submission-format-type";
import {
  ForeignKeyConstraintError,
  RecordNotFoundError,
  UniqueConstraintError,
} from "@/infrastructure/persistence/persistence-errors";
import { designForProblem } from "@/testing/fixtures";
import type { Problem } from "@/domain/problem/problem";
import { createIntegrationHarness, SEED_LEARNER_ID, seedAndLoadProblem } from "./harness";

const harness = createIntegrationHarness();

afterAll(async () => {
  await harness.prisma.$disconnect();
});

const NOW = new Date("2026-03-01T09:00:00.000Z");

function attemptFor(
  problem: Problem,
  overrides: { id?: string; attemptNumber?: number; learnerId?: string } = {},
): Attempt {
  return Attempt.start({
    id: overrides.id ?? "att_test_1",
    problemId: problem.id,
    learnerId: overrides.learnerId ?? SEED_LEARNER_ID,
    attemptNumber: overrides.attemptNumber ?? 1,
    now: NOW,
  });
}

describe("database constraints", () => {
  it("rejects a second attempt with the same number for one learner and problem", async () => {
    const problem = await seedAndLoadProblem(harness);
    await harness.repositories.attempts.save(attemptFor(problem));

    await expect(
      harness.repositories.attempts.save(
        attemptFor(problem, { id: "att_test_2", attemptNumber: 1 }),
      ),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("rejects a duplicate attempt id", async () => {
    const problem = await seedAndLoadProblem(harness);
    await harness.repositories.attempts.save(attemptFor(problem));

    await expect(
      harness.repositories.attempts.save(attemptFor(problem, { attemptNumber: 2 })),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("rejects an attempt for a learner that does not exist", async () => {
    const problem = await seedAndLoadProblem(harness);

    await expect(
      harness.repositories.attempts.save(
        attemptFor(problem, { learnerId: "lrn_ghost" }),
      ),
    ).rejects.toThrow(ForeignKeyConstraintError);
  });

  it("rejects two submissions with the same version on one attempt", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = attemptFor(problem);
    await harness.repositories.attempts.save(attempt);

    const first = Submission.create({
      id: "sub_test_1",
      attemptId: attempt.id,
      version: 1,
      formatType: STRUCTURED_DESIGN,
      payload: designForProblem(problem),
      createdAt: NOW,
    });
    await harness.repositories.submissions.save(first);

    const duplicate = Submission.create({
      id: "sub_test_2",
      attemptId: attempt.id,
      version: 1,
      formatType: STRUCTURED_DESIGN,
      payload: designForProblem(problem),
      createdAt: NOW,
    });

    await expect(
      harness.repositories.submissions.save(duplicate),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("rejects a submission for an attempt that does not exist", async () => {
    const problem = await seedAndLoadProblem(harness);

    const orphan = Submission.create({
      id: "sub_orphan",
      attemptId: "att_ghost",
      version: 1,
      formatType: STRUCTURED_DESIGN,
      payload: designForProblem(problem),
      createdAt: NOW,
    });

    await expect(harness.repositories.submissions.save(orphan)).rejects.toThrow(
      ForeignKeyConstraintError,
    );
  });

  it("rejects two classes with the same name inside one design", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = attemptFor(problem);
    await harness.repositories.attempts.save(attempt);
    const design = designForProblem(problem);

    attempt.saveDraft(
      {
        ...design,
        classes: [...design.classes, { ...design.classes[0]!, id: "class-dupe" }],
      },
      NOW,
    );

    await expect(harness.repositories.attempts.update(attempt)).rejects.toThrow(
      UniqueConstraintError,
    );
  });

  it("keeps a unique problem slug", async () => {
    await seedAndLoadProblem(harness);

    await expect(
      harness.prisma.problem.create({
        data: {
          id: "prb_clash",
          slug: "parking-lot",
          title: "Clash",
          description: "d",
          context: "c",
          constraints: [],
          acceptedSubmissionFormats: ["STRUCTURED_DESIGN"],
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
      }),
    ).rejects.toThrow();
  });

  it("keeps requirement codes unique within a problem", async () => {
    const problem = await seedAndLoadProblem(harness);
    const existing = problem.requirements[0]!;

    await expect(
      harness.prisma.requirement.create({
        data: {
          id: "req_clash",
          problemId: problem.id,
          code: existing.code,
          title: "Clash",
          description: "d",
          priority: "MUST",
          position: 99,
        },
      }),
    ).rejects.toThrow();
  });

  it("lets two problems use the same requirement code", async () => {
    await seedAndLoadProblem(harness);
    const codes = await harness.prisma.requirement.findMany({
      where: { code: "PL-REQ-01" },
    });

    expect(codes).toHaveLength(1);

    const created = await harness.prisma.requirement.create({
      data: {
        id: "req_other_problem_same_code",
        problemId: "prb_vending_machine",
        code: "PL-REQ-01",
        title: "Same code, different problem",
        description: "d",
        priority: "MUST",
        position: 99,
      },
    });

    expect(created.id).toBe("req_other_problem_same_code");
  });
});

describe("transaction boundaries", () => {
  it("rolls the whole draft replacement back when one child row is rejected", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = attemptFor(problem);
    await harness.repositories.attempts.save(attempt);

    const goodDesign = designForProblem(problem);
    attempt.saveDraft(goodDesign, NOW);
    await harness.repositories.attempts.update(attempt);

    const designsBefore = await harness.prisma.design.count();

    // A mapping pointing at a requirement of no problem violates the foreign key
    // on the very last child insert, after the design row already exists.
    attempt.saveDraft(
      {
        ...goodDesign,
        requirementMappings: [
          { requirementId: "req_ghost", references: [{ entity: "ParkingLot" }] },
        ],
      },
      NOW,
    );

    await expect(harness.repositories.attempts.update(attempt)).rejects.toThrow();

    expect(await harness.prisma.design.count()).toBe(designsBefore);
    const reloaded = await harness.repositories.attempts.findById(attempt.id);
    expect(reloaded?.draftDesign).toEqual(goodDesign);
  });

  it("writes a submission and its design together or not at all", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = attemptFor(problem);
    await harness.repositories.attempts.save(attempt);

    const invalid = Submission.create({
      id: "sub_test_1",
      attemptId: attempt.id,
      version: 1,
      formatType: STRUCTURED_DESIGN,
      payload: {
        ...designForProblem(problem),
        requirementMappings: [
          { requirementId: "req_ghost", references: [{ entity: "ParkingLot" }] },
        ],
      },
      createdAt: NOW,
    });

    await expect(harness.repositories.submissions.save(invalid)).rejects.toThrow();

    expect(await harness.prisma.submission.count()).toBe(0);
    expect(await harness.prisma.design.count()).toBe(0);
  });

  it("writes nothing when updating an evaluation that was never saved", async () => {
    const problem = await seedAndLoadProblem(harness);
    const attempt = attemptFor(problem);
    await harness.repositories.attempts.save(attempt);

    const submission = Submission.create({
      id: "sub_test_1",
      attemptId: attempt.id,
      version: 1,
      formatType: STRUCTURED_DESIGN,
      payload: designForProblem(problem),
      createdAt: NOW,
    });
    await harness.repositories.submissions.save(submission);

    const neverSaved = Evaluation.request({
      id: "evl_never_saved",
      submissionId: submission.id,
      versions: {
        evaluatorVersion: "hybrid-v1",
        rubricVersion: "parking-lot-v1",
        promptVersion: "design-review-v1",
        knowledgeVersion: "lld-kb-v1",
      },
      idempotencyKey: "att_test_1:v1:hybrid-v1",
      now: NOW,
    });
    neverSaved.start(NOW);
    neverSaved.complete(
      {
        criterionResults: [
          {
            criterion: "RESPONSIBILITY",
            assessment: "ADEQUATE",
            evidence: [{ entity: "ParkingLot" }],
          },
        ],
        strengths: [],
        priorityImprovements: [],
        summary: "Never persisted.",
      },
      NOW,
    );

    await expect(
      harness.repositories.evaluations.update(neverSaved),
    ).rejects.toThrow(RecordNotFoundError);

    expect(await harness.prisma.evaluation.count()).toBe(0);
    expect(await harness.prisma.evaluationCriterionResult.count()).toBe(0);
  });
});
